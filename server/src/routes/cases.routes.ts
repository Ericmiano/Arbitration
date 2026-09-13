import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit.service';
import { canAccessCase, SessionUser } from '../services/caseAccess.service';
import { generateCaseNumber } from '../services/caseNumber.service';
import { deriveSlaTier } from '../services/sla.service';

export const caseRoutes = Router();

caseRoutes.use(requireAuth);

const caseSummaryInclude: Prisma.casesInclude = {
  case_parties: { include: { parties: { select: { id: true, full_name: true } } } },
  assignments: {
    // Includes 'completed' - once a case concludes its arbitrator's
    // assignment status flips to 'completed', and without it here the
    // frontend loses track of who the arbitrator ever was on a closed case.
    // 'withdrawn'/'reassigned' stay excluded since those aren't current.
    where: { status: { in: ['ongoing', 'overdue', 'escalated', 'completed'] } },
    include: { arbitrators: { select: { id: true, full_name: true } } },
    orderBy: { assigned_at: 'desc' },
    take: 1,
  },
  projects: { select: { id: true, name: true, location: true } },
};

/** Cases visible to the current session user, scoped by role. */
caseRoutes.get('/', async (req, res, next) => {
  try {
    const sessionUser = req.session.user!;

    if (sessionUser.role === 'admin' || sessionUser.role === 'registrar' || sessionUser.role === 'staff') {
      const cases = await prisma.cases.findMany({
        include: caseSummaryInclude,
        orderBy: { filed_at: 'desc' },
      });
      res.json(cases);
      return;
    }

    if (sessionUser.role === 'arbitrator') {
      const arbitrator = await prisma.arbitrators.findUnique({ where: { user_id: sessionUser.id } });
      if (!arbitrator) {
        res.json([]);
        return;
      }
      const cases = await prisma.cases.findMany({
        where: { assignments: { some: { arbitrator_id: arbitrator.id } } },
        include: caseSummaryInclude,
        orderBy: { filed_at: 'desc' },
      });
      res.json(cases);
      return;
    }

    // role === 'party'
    const cases = await prisma.cases.findMany({
      where: { case_parties: { some: { parties: { user_id: sessionUser.id } } } },
      include: caseSummaryInclude,
      orderBy: { filed_at: 'desc' },
    });
    res.json(cases);
  } catch (error) {
    next(error);
  }
});

const createCaseSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  contractId: z.coerce.number().int().positive().optional(),
  disputeValue: z.coerce.number().positive(),
  currency: z.string().length(3).default('KES'),
  category: z.string().min(1).max(100),
  description: z.string().min(1),
  basis: z.enum(['contractual_clause', 'mutual_agreement']),
  parties: z
    .array(
      z.object({
        partyId: z.coerce.number().int().positive(),
        role: z.enum(['claimant', 'respondent', 'other']),
      }),
    )
    .min(2),
});

caseRoutes.post('/', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const parseResult = createCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const input = parseResult.data;

    if (input.basis === 'contractual_clause') {
      if (!input.contractId) {
        res.status(400).json({ error: 'contractId is required when basis is contractual_clause' });
        return;
      }
      const contract = await prisma.contracts.findUnique({ where: { id: input.contractId } });
      if (!contract || !contract.has_arbitration_clause) {
        res.status(400).json({
          error: 'The referenced contract has no arbitration clause on file - use basis "mutual_agreement" instead',
        });
        return;
      }
    }

    const slaTier = await deriveSlaTier(input.disputeValue, input.currency);
    const caseNumber = await generateCaseNumber();
    const initialStatus = input.basis === 'contractual_clause' ? 'pending_assignment' : 'pending_agreement';

    const created = await prisma.cases.create({
      data: {
        case_number: caseNumber,
        project_id: input.projectId,
        contract_id: input.contractId,
        dispute_value: input.disputeValue,
        currency: input.currency,
        category: input.category,
        description: input.description,
        basis: input.basis,
        sla_tier: slaTier,
        status: initialStatus,
        created_by: req.session.user!.id,
        case_parties: {
          create: input.parties.map((p) => ({ party_id: p.partyId, role: p.role })),
        },
      },
      include: caseSummaryInclude,
    });

    await logAudit({
      userId: req.session.user!.id,
      action: 'case_created',
      entityType: 'case',
      entityId: created.id,
      ipAddress: req.ip,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

async function loadCaseIfVisible(caseId: number, sessionUser: SessionUser) {
  const hasAccess = await canAccessCase(caseId, sessionUser);
  if (!hasAccess) return null;
  return prisma.cases.findUnique({ where: { id: caseId }, include: caseSummaryInclude });
}

const confirmAgreementSchema = z.object({
  documentPublicId: z.string().uuid(),
});

/**
 * For basis = 'mutual_agreement' cases: staff confirm that both parties have
 * submitted a signed submission agreement (uploaded beforehand via
 * POST /documents against this case), moving the case out of
 * 'pending_agreement' into the assignable pool.
 */
caseRoutes.patch(
  '/:caseId/confirm-agreement',
  requireRole('admin', 'registrar', 'staff'),
  async (req, res, next) => {
    try {
      const caseId = Number(req.params.caseId);
      const parseResult = confirmAgreementSchema.safeParse(req.body);
      if (!Number.isInteger(caseId) || !parseResult.success) {
        res.status(400).json({ error: 'Invalid case id or documentPublicId' });
        return;
      }

      const caseRecord = await prisma.cases.findUnique({ where: { id: caseId } });
      if (!caseRecord) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }
      if (caseRecord.basis !== 'mutual_agreement' || caseRecord.status !== 'pending_agreement') {
        res.status(400).json({
          error: 'Case is not awaiting a submission agreement',
        });
        return;
      }

      const document = await prisma.documents.findUnique({
        where: { public_id: parseResult.data.documentPublicId },
      });
      if (!document || document.case_id !== caseRecord.id || document.document_type !== 'submission_agreement') {
        res.status(400).json({
          error: 'documentPublicId must reference a submission_agreement document already uploaded for this case',
        });
        return;
      }

      const updated = await prisma.cases.update({
        where: { id: caseId },
        data: { submission_agreement_doc_id: document.id, status: 'pending_assignment' },
        include: caseSummaryInclude,
      });

      await logAudit({
        userId: req.session.user!.id,
        action: 'case_agreement_confirmed',
        entityType: 'case',
        entityId: caseId,
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

caseRoutes.get('/:caseId', async (req, res, next) => {
  try {
    const caseId = Number(req.params.caseId);
    if (!Number.isInteger(caseId)) {
      res.status(400).json({ error: 'Invalid case id' });
      return;
    }

    const caseRecord = await loadCaseIfVisible(caseId, req.session.user!);
    if (!caseRecord) {
      // Same response whether the case doesn't exist or the caller can't see
      // it - don't leak case existence to accounts with no relationship to it.
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    res.json(caseRecord);
  } catch (error) {
    next(error);
  }
});
