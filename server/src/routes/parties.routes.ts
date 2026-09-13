import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { parseId } from '../lib/parseId';
import { idSchema } from '../lib/zodId';
import { LIST_HARD_CAP } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware/auth';

export const partyRoutes = Router();

partyRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

partyRoutes.get('/', async (_req, res, next) => {
  try {
    const parties = await prisma.parties.findMany({
      include: { organizations: { select: { id: true, name: true } } },
      orderBy: { full_name: 'asc' },
      take: LIST_HARD_CAP,
    });
    res.json(parties);
  } catch (error) {
    next(error);
  }
});

const createPartySchema = z.object({
  type: z.enum(['individual', 'organization']),
  organizationId: idSchema.optional(),
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

const inviteSchema = z.object({
  email: z.string().email(),
});

/**
 * Grants a party portal access - creates their login (role='party') and
 * links it to the existing party record, so they can log in to view their
 * own case(s) and documents shared with them. A party created purely for
 * record-keeping (staff manage everything on their behalf) never needs this.
 */
partyRoutes.post('/:partyId/invite', async (req, res, next) => {
  try {
    const partyId = parseId(req.params.partyId);
    const parseResult = inviteSchema.safeParse(req.body);
    if (partyId === null || !parseResult.success) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }

    const party = await prisma.parties.findUnique({ where: { id: partyId } });
    if (!party) {
      res.status(404).json({ error: 'Party not found' });
      return;
    }
    if (party.user_id) {
      res.status(409).json({ error: 'Party already has portal access' });
      return;
    }

    const existingUser = await prisma.users.findUnique({ where: { email: parseResult.data.email } });
    if (existingUser) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: { email: parseResult.data.email, password_hash: passwordHash, role: 'party' },
      });
      await tx.parties.update({ where: { id: partyId }, data: { user_id: user.id } });
    });

    res.status(201).json({ message: 'Portal access granted', temporaryPassword });
  } catch (error) {
    next(error);
  }
});
