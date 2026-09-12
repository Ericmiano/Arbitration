import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/audit.service';

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
      invalidCredentials();
      return;
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
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

    res.json({ id: user.public_id, email: user.email, role: user.role });
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

authRoutes.get('/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.session.user);
});
