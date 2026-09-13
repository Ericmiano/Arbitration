import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { parseId } from '../lib/parseId';
import { idSchema } from '../lib/zodId';
import { LIST_HARD_CAP } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware/auth';

export const projectRoutes = Router();

projectRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

projectRoutes.get('/', async (_req, res, next) => {
  try {
    const projects = await prisma.projects.findMany({
      include: { contracts: { select: { id: true, reference_number: true, has_arbitration_clause: true } } },
      orderBy: { name: 'asc' },
      take: LIST_HARD_CAP,
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sector: z.string().max(150).optional(),
  value: z.coerce.number().positive().optional(),
  currency: z.string().length(3).default('KES'),
  location: z.string().max(255).optional(),
});

projectRoutes.post('/', async (req, res, next) => {
  try {
    const parseResult = createProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const project = await prisma.projects.create({ data: parseResult.data });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

const createContractSchema = z.object({
  projectId: idSchema,
  referenceNumber: z.string().max(150).optional(),
  executionDate: z.coerce.date().optional(),
  value: z.coerce.number().positive().optional(),
  currency: z.string().length(3).default('KES'),
  hasArbitrationClause: z.boolean().default(false),
  arbitrationClauseText: z.string().optional(),
  governingLaw: z.string().max(150).optional(),
  parties: z.array(z.object({ partyId: idSchema, role: z.string().min(1).max(100) })).min(2),
});

projectRoutes.post('/:projectId/contracts', async (req, res, next) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (projectId === null) {
      res.status(400).json({ error: 'Invalid project id' });
      return;
    }
    const parseResult = createContractSchema.safeParse({ ...req.body, projectId });
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    const input = parseResult.data;

    const contract = await prisma.contracts.create({
      data: {
        project_id: input.projectId,
        reference_number: input.referenceNumber,
        execution_date: input.executionDate,
        value: input.value,
        currency: input.currency,
        has_arbitration_clause: input.hasArbitrationClause,
        arbitration_clause_text: input.arbitrationClauseText,
        governing_law: input.governingLaw,
        contract_parties: { create: input.parties.map((p) => ({ party_id: p.partyId, role: p.role })) },
      },
      include: { contract_parties: true },
    });

    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
});
