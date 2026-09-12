import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { checkConflicts } from '../services/conflict.service';

export const arbitratorRoutes = Router();

arbitratorRoutes.use(requireAuth);

const createArbitratorSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  credentials: z.string().optional(),
  specializations: z.array(z.string().min(1).max(150)).default([]),
  joinedAt: z.coerce.date().default(() => new Date()),
});

/**
 * Onboards a new arbitrator: creates their login (role='arbitrator') and
 * profile together. Returns a one-time temporary password - AAK is
 * responsible for delivering it to the arbitrator out of band and should
 * have them change it on first login (no forced-change flow exists yet).
 */
arbitratorRoutes.post('/', requireRole('admin', 'registrar'), async (req, res, next) => {
  try {
    const parseResult = createArbitratorSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const input = parseResult.data;

    const existingUser = await prisma.users.findUnique({ where: { email: input.email } });
    if (existingUser) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const arbitrator = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: { email: input.email, password_hash: passwordHash, role: 'arbitrator' },
      });
      return tx.arbitrators.create({
        data: {
          user_id: user.id,
          full_name: input.fullName,
          credentials: input.credentials,
          joined_at: input.joinedAt,
          arbitrator_specializations: {
            create: input.specializations.map((specialization) => ({ specialization })),
          },
        },
        include: { arbitrator_specializations: true },
      });
    });

    res.status(201).json({ arbitrator, temporaryPassword });
  } catch (error) {
    next(error);
  }
});

arbitratorRoutes.get('/', requireRole('admin', 'registrar', 'staff'), async (_req, res, next) => {
  try {
    const arbitrators = await prisma.arbitrators.findMany({
      include: {
        arbitrator_specializations: true,
        assignments: {
          where: { status: { in: ['ongoing', 'overdue', 'escalated'] } },
          select: { id: true, case_id: true, status: true, due_date: true },
        },
      },
      orderBy: { score: 'desc' },
    });
    res.json(arbitrators);
  } catch (error) {
    next(error);
  }
});

const eligibleQuerySchema = z.object({
  caseId: z.coerce.number().int().positive(),
});

/**
 * The conflict-cleared, active arbitrator pool for a case, sorted by score
 * (soft ranking only - staff make the final assignment call, per the agreed
 * design). Arbitrators with a declared conflict are excluded outright;
 * arbitrators with a prior-engagement signal are included but flagged, since
 * name/party matches alone aren't reliable enough to auto-exclude.
 */
arbitratorRoutes.get('/eligible', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const parseResult = eligibleQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'caseId query parameter is required' });
      return;
    }
    const { caseId } = parseResult.data;

    const caseRecord = await prisma.cases.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    const activeArbitrators = await prisma.arbitrators.findMany({
      where: { status: 'active' },
      orderBy: { score: 'desc' },
    });

    const withConflictInfo = await Promise.all(
      activeArbitrators.map(async (arbitrator) => {
        const conflicts = await checkConflicts(Number(arbitrator.id), caseId);
        return { arbitrator, conflicts };
      }),
    );

    const eligible = withConflictInfo
      .filter(({ conflicts }) => !conflicts.blocked)
      .map(({ arbitrator, conflicts }) => ({
        ...arbitrator,
        priorEngagementFlags: conflicts.priorEngagements,
      }));

    res.json(eligible);
  } catch (error) {
    next(error);
  }
});

const declareConflictSchema = z
  .object({
    partyId: z.coerce.number().int().positive().optional(),
    organizationId: z.coerce.number().int().positive().optional(),
    reason: z.string().min(1).max(500),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((data) => data.partyId !== undefined || data.organizationId !== undefined, {
    message: 'Either partyId or organizationId is required',
  });

arbitratorRoutes.post(
  '/:arbitratorId/conflicts',
  requireRole('admin', 'registrar'),
  async (req, res, next) => {
    try {
      const arbitratorId = Number(req.params.arbitratorId);
      const parseResult = declareConflictSchema.safeParse(req.body);
      if (!Number.isInteger(arbitratorId) || !parseResult.success) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }
      const input = parseResult.data;

      const created = await prisma.arbitrator_conflicts.create({
        data: {
          arbitrator_id: arbitratorId,
          conflicted_party_id: input.partyId,
          conflicted_organization_id: input.organizationId,
          reason: input.reason,
          expires_at: input.expiresAt,
        },
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  },
);
