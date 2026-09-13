import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/audit.service';
import { resolveDisplayName } from '../services/userProfile.service';

export const authRoutes = Router();

// Brute-force protection on login specifically (in addition to the
// per-account lockout below, which survives across IPs/proxies).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const { email, password } = parseResult.data;

    const user = await prisma.users.findUnique({ where: { email } });

    // Same generic message whether the account doesn't exist or the password
    // is wrong - don't let a caller enumerate registered emails.
    const invalidCredentials = () => res.status(401).json({ error: 'Invalid email or password' });

    if (!user) {
      // Deliberately not audited against a specific user record - there is
      // none to attribute it to, and logging the attempted email here would
      // itself accumulate a list of guessed addresses. The rate limiter is
      // the control for this case, not the audit log.
      invalidCredentials();
      return;
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      await logAudit({
        userId: Number(user.id),
        action: 'login_blocked_locked_account',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip,
      });
      res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      const failedCount = user.failed_login_count + 1;
      const lockingOut = failedCount >= MAX_FAILED_ATTEMPTS;
      await prisma.users.update({
        where: { id: user.id },
        data: {
          failed_login_count: lockingOut ? 0 : failedCount,
          locked_until: lockingOut ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      });
      await logAudit({
        userId: Number(user.id),
        action: lockingOut ? 'login_failed_account_locked' : 'login_failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { failedCount },
        ipAddress: req.ip,
      });
      invalidCredentials();
      return;
    }

    await prisma.users.update({
      where: { id: user.id },
      data: { failed_login_count: 0, locked_until: null, last_login_at: new Date() },
    });

    req.session.user = { id: Number(user.id), role: user.role };

    await logAudit({
      userId: Number(user.id),
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });

    const fullName = await resolveDisplayName(Number(user.id), user.role, user.email);
    res.json({ id: user.public_id, email: user.email, role: user.role, fullName });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRoutes.post('/change-password', async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'currentPassword and a newPassword of at least 8 characters are required' });
      return;
    }

    const user = await prisma.users.findUniqueOrThrow({ where: { id: req.session.user.id } });
    const currentMatches = await bcrypt.compare(parseResult.data.currentPassword, user.password_hash);
    if (!currentMatches) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(parseResult.data.newPassword, 12);
    await prisma.users.update({ where: { id: user.id }, data: { password_hash: newHash } });

    await logAudit({
      userId: Number(user.id),
      action: 'password_changed',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

authRoutes.get('/me', async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await prisma.users.findUnique({ where: { id: req.session.user.id } });
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const fullName = await resolveDisplayName(req.session.user.id, req.session.user.role, user.email);
    res.json({ id: req.session.user.id, role: req.session.user.role, fullName, email: user.email });
  } catch (error) {
    next(error);
  }
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(255),
});

/**
 * Self-service display-name update. Staff/admin/registrar only - arbitrators
 * and parties display their arbitrators/parties.full_name instead (see
 * resolveDisplayName), managed through those records, not this endpoint.
 * A prior version accepted this from any role: it silently updated
 * users.full_name with no visible effect, since resolveDisplayName never
 * reads it for those roles - confusing UX, now rejected outright instead.
 */
authRoutes.patch('/profile', async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!['admin', 'registrar', 'staff'].includes(req.session.user.role)) {
      res.status(403).json({
        error: 'Your display name is managed through your arbitrator/party record, not here.',
      });
      return;
    }
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'fullName is required' });
      return;
    }
    await prisma.users.update({
      where: { id: req.session.user.id },
      data: { full_name: parseResult.data.fullName },
    });
    res.json({ message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
});
