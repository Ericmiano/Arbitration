import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const partyRoutes = Router();

partyRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

partyRoutes.get('/', async (_req, res, next) => {
  try {
    const parties = await prisma.parties.findMany({
      include: { organizations: { select: { id: true, name: true } } },
      orderBy: { full_name: 'asc' },
    });
    res.json(parties);
  } catch (error) {
    next(error);
  }
});

const createPartySchema = z.object({
  type: z.enum(['individual', 'organization']),
  organizationId: z.coerce.number().int().positive().optional(),
  fullName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

/**
 * Creates a party record for intake purposes. This does NOT create a portal
 * login (parties.user_id stays null) - that's a separate, deliberate step
 * once AAK wants to grant a party document-viewing access to the system.
 */
partyRoutes.post('/', async (req, res, next) => {
  try {
    const parseResult = createPartySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const input = parseResult.data;

    if (input.type === 'organization' && !input.organizationId) {
      res.status(400).json({ error: 'organizationId is required when type is organization' });
      return;
    }

    const party = await prisma.parties.create({
      data: {
        type: input.type,
        organization_id: input.type === 'organization' ? input.organizationId : undefined,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });

    res.status(201).json(party);
  } catch (error) {
    next(error);
  }
});
