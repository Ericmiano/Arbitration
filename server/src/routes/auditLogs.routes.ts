import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { idSchema } from '../lib/zodId';
import { LIST_HARD_CAP } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware/auth';

export const auditLogRoutes = Router();

// Read access to the audit trail is admin-only - it's the record of
// everyone's actions across every case, well beyond what a registrar or
// staff account needs day to day.
auditLogRoutes.use(requireAuth, requireRole('admin'));

const listQuerySchema = z.object({
  action: z.string().max(100).optional(),
  entityType: z.string().max(50).optional(),
  userId: idSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(LIST_HARD_CAP).default(100),
});

auditLogRoutes.get('/', async (req, res, next) => {
  try {
    const parseResult = listQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const { action, entityType, userId, from, to, limit } = parseResult.data;

    const logs = await prisma.audit_logs.findMany({
      where: {
        action: action ? { contains: action } : undefined,
        entity_type: entityType ? { equals: entityType } : undefined,
        user_id: userId,
        created_at: from || to ? { gte: from, lte: to } : undefined,
      },
      include: { users: { select: { email: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    res.json(
      logs.map((log) => ({
        id: log.id,
        userEmail: log.users?.email ?? null,
        userRole: log.users?.role ?? null,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        metadata: safeParseJson(log.metadata),
        ipAddress: log.ip_address,
        createdAt: log.created_at,
      })),
    );
  } catch (error) {
    next(error);
  }
});

function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
