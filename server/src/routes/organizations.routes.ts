import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const organizationRoutes = Router();

organizationRoutes.use(requireAuth);

organizationRoutes.get('/', async (_req, res, next) => {
  try {
    const organizations = await prisma.organizations.findMany({ orderBy: { name: 'asc' } });
    res.json(organizations);
  } catch (error) {
    next(error);
  }
});

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  registrationNumber: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  sector: z.string().max(150).optional(),
});

organizationRoutes.post('/', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const parseResult = createOrganizationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const input = parseResult.data;

    const organization = await prisma.organizations.create({
      data: {
        name: input.name,
        registration_number: input.registrationNumber,
        address: input.address,
        sector: input.sector,
      },
    });

    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
});
