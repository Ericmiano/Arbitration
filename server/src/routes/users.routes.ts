import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { sendMail } from '../lib/mail';
import { prisma } from '../lib/prisma';
import { parseId } from '../lib/parseId';
import { LIST_HARD_CAP } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit.service';
import { resolveDisplayName } from '../services/userProfile.service';

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

userRoutes.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, email: true, role: true, status: true, full_name: true, last_login_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: LIST_HARD_CAP,
    });

    const withNames = await Promise.all(
      users.map(async (u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        fullName: await resolveDisplayName(Number(u.id), u.role, u.email),
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      })),
    );

    res.json(withNames);
  } catch (error) {
    next(error);
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(['admin', 'registrar', 'staff']),
});

/**
 * Onboards a new staff-side account. There was previously no way to do this
 * at all short of editing the database directly - the seed script makes
 * exactly one admin, and every other route only ever creates a user as a
 * side effect of creating an arbitrator/party record. The new account gets
 * a random, unknown, unusable password and is immediately sent a
 * password-reset link (reusing the same flow as "forgot password") so it
 * sets its own password on first login rather than an admin knowing it.
 */
userRoutes.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const { email, fullName, role } = parseResult.data;

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const user = await prisma.users.create({
      data: { email, full_name: fullName, role, password_hash: passwordHash, status: 'active' },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.password_reset_tokens.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const setupUrl = `${env.CORS_ORIGIN}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: 'AAK Arbitration Register - set up your account',
      text: `An account has been created for you on the AAK Arbitration Register (role: ${role}).\n\nSet your password to activate it: ${setupUrl}\n\nThis link expires in 24 hours.`,
    });

    await logAudit({
      userId: req.session.user!.id,
      action: 'user_created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, role },
      ipAddress: req.ip,
    });

    res.status(201).json({ id: user.id, email: user.email, role: user.role, fullName });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z
  .object({
    role: z.enum(['admin', 'registrar', 'staff']).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  })
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: 'role or status is required',
  });

/**
 * Role/status editing for staff-side accounts only (admin/registrar/staff).
 * Arbitrator and party accounts are never touched here - their role is
 * fixed at creation and tied to a linked arbitrators/parties row that this
 * endpoint knows nothing about, so allowing a role change into or out of
 * those would leave that row orphaned or missing.
 */
userRoutes.patch('/:userId', requireRole('admin'), async (req, res, next) => {
  try {
    const userId = parseId(req.params.userId);
    const parseResult = updateUserSchema.safeParse(req.body);
    if (userId === null || !parseResult.success) {
      res.status(400).json({ error: 'A valid role or status is required' });
      return;
    }
    const { role, status } = parseResult.data;

    const target = await prisma.users.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!['admin', 'registrar', 'staff'].includes(target.role)) {
      res.status(400).json({
        error: 'Arbitrator and party accounts are managed from the Arbitrators and Parties pages, not here.',
      });
      return;
    }

    const sessionUserId = req.session.user!.id;
    const demotingOrDeactivatingSelf =
      userId === sessionUserId && ((role !== undefined && role !== 'admin') || (status !== undefined && status !== 'active'));
    if (demotingOrDeactivatingSelf) {
      res.status(400).json({ error: "You can't change your own role or deactivate your own account." });
      return;
    }

    const removingAdminRights =
      target.role === 'admin' && ((role !== undefined && role !== 'admin') || (status !== undefined && status !== 'active'));
    if (removingAdminRights) {
      const otherActiveAdmins = await prisma.users.count({
        where: { role: 'admin', status: 'active', id: { not: userId } },
      });
      if (otherActiveAdmins === 0) {
        res.status(400).json({ error: 'Cannot remove the last active administrator.' });
        return;
      }
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: { role, status },
    });

    await logAudit({
      userId: sessionUserId,
      action: 'user_role_status_changed',
      entityType: 'user',
      entityId: userId,
      metadata: { previousRole: target.role, previousStatus: target.status, newRole: role, newStatus: status },
      ipAddress: req.ip,
    });

    res.json({ id: updated.id, role: updated.role, status: updated.status });
  } catch (error) {
    next(error);
  }
});
