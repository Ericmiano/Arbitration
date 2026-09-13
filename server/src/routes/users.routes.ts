import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { resolveDisplayName } from '../services/userProfile.service';

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

userRoutes.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, email: true, role: true, status: true, full_name: true, last_login_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
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
