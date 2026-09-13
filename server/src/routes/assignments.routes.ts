import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { parseId } from '../lib/parseId';
import { idSchema } from '../lib/zodId';
import { requireAuth, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit.service';
import { recalculateArbitratorScore } from '../services/scoring.service';
import { checkConflicts } from '../services/conflict.service';
import { computeDueDate } from '../services/sla.service';

export const assignmentRoutes = Router();

assignmentRoutes.use(requireAuth);

const createAssignmentSchema = z.object({
  caseId: idSchema,
  arbitratorId: idSchema,
});

assignmentRoutes.post('/', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const parseResult = createAssignmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'caseId and arbitratorId are required' });
      return;
    }
    const { caseId, arbitratorId } = parseResult.data;

    const caseRecord = await prisma.cases.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    if (caseRecord.status !== 'pending_assignment') {
      res.status(400).json({ error: `Case is not awaiting assignment (status: ${caseRecord.status})` });
      return;
    }

    const arbitrator = await prisma.arbitrators.findUnique({ where: { id: arbitratorId } });
    if (!arbitrator || arbitrator.status !== 'active') {
      res.status(400).json({ error: 'Arbitrator is not active or does not exist' });
      return;
    }

    // Re-check conflicts server-side even though the UI's /arbitrators/eligible
    // already filtered them out - never trust the client for this.
    const conflicts = await checkConflicts(arbitratorId, caseId);
    if (conflicts.blocked) {
      res.status(409).json({ error: 'Arbitrator has a declared conflict of interest for this case', conflicts });
      return;
    }

    const dueDate = await computeDueDate(caseRecord.sla_tier, caseRecord.currency, new Date());

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignments.create({
        data: {
          case_id: caseId,
          arbitrator_id: arbitratorId,
          assigned_by: req.session.user!.id,
          due_date: dueDate,
          status: 'ongoing',
        },
      });
      await tx.cases.update({
        where: { id: caseId },
        data: { due_date: dueDate, status: 'ongoing' },
      });
      return created;
    });

    await logAudit({
      userId: req.session.user!.id,
      action: 'assignment_created',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: { caseId, arbitratorId },
      ipAddress: req.ip,
    });

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

const requestExtensionSchema = z.object({
  reason: z.string().min(1).max(500),
  requestedDueDate: z.coerce.date(),
});

assignmentRoutes.post('/:assignmentId/extensions', async (req, res, next) => {
  try {
    const assignmentId = parseId(req.params.assignmentId);
    const parseResult = requestExtensionSchema.safeParse(req.body);
    if (assignmentId === null || !parseResult.success) {
      res.status(400).json({ error: 'reason and requestedDueDate are required' });
      return;
    }

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
      include: { arbitrators: true },
    });
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const sessionUser = req.session.user!;
    const isOwningArbitrator =
      sessionUser.role === 'arbitrator' && Number(assignment.arbitrators.user_id) === sessionUser.id;
    const isStaff = ['admin', 'registrar', 'staff'].includes(sessionUser.role);
    if (!isOwningArbitrator && !isStaff) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const extension = await prisma.assignment_extensions.create({
      data: {
        assignment_id: assignmentId,
        requested_by: sessionUser.id,
        reason: parseResult.data.reason,
        previous_due_date: assignment.due_date,
        new_due_date: parseResult.data.requestedDueDate,
      },
    });

    res.status(201).json(extension);
  } catch (error) {
    next(error);
  }
});

assignmentRoutes.get('/:assignmentId/extensions', async (req, res, next) => {
  try {
    const assignmentId = parseId(req.params.assignmentId);
    if (assignmentId === null) {
      res.status(400).json({ error: 'Invalid assignment id' });
      return;
    }

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
      include: { arbitrators: true },
    });
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const sessionUser = req.session.user!;
    const isOwningArbitrator =
      sessionUser.role === 'arbitrator' && Number(assignment.arbitrators.user_id) === sessionUser.id;
    const isStaff = ['admin', 'registrar', 'staff'].includes(sessionUser.role);
    if (!isOwningArbitrator && !isStaff) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const extensions = await prisma.assignment_extensions.findMany({
      where: { assignment_id: assignmentId },
      orderBy: { requested_at: 'desc' },
    });

    res.json(extensions);
  } catch (error) {
    next(error);
  }
});

const decideExtensionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

assignmentRoutes.patch(
  '/:assignmentId/extensions/:extensionId',
  requireRole('admin', 'registrar', 'staff'),
  async (req, res, next) => {
    try {
      const extensionId = parseId(req.params.extensionId);
      const parseResult = decideExtensionSchema.safeParse(req.body);
      if (extensionId === null || !parseResult.success) {
        res.status(400).json({ error: 'decision must be "approved" or "rejected"' });
        return;
      }

      const extension = await prisma.assignment_extensions.findUnique({ where: { id: extensionId } });
      if (!extension || extension.status !== 'pending') {
        res.status(404).json({ error: 'No pending extension request found' });
        return;
      }

      const { decision } = parseResult.data;

      await prisma.$transaction(async (tx) => {
        await tx.assignment_extensions.update({
          where: { id: extensionId },
          data: { status: decision, decided_by: req.session.user!.id, decided_at: new Date() },
        });

        if (decision === 'approved') {
          await tx.assignments.update({
            where: { id: extension.assignment_id },
            data: {
              due_date: extension.new_due_date,
              // Pushing the due date forward clears any overdue/escalated flag.
              status: 'ongoing',
            },
          });
          await tx.cases.update({
            where: {
              id: (await tx.assignments.findUniqueOrThrow({ where: { id: extension.assignment_id } })).case_id,
            },
            data: { due_date: extension.new_due_date },
          });
        }
      });

      res.json({ message: `Extension ${decision}` });
    } catch (error) {
      next(error);
    }
  },
);

const completeAssignmentSchema = z.object({
  outcome: z.enum(['award_issued', 'settled', 'withdrawn']),
  outcomeDetail: z.string().max(5000).optional(),
  awardChallenged: z.boolean().optional(),
});

assignmentRoutes.post('/:assignmentId/complete', async (req, res, next) => {
  try {
    const assignmentId = parseId(req.params.assignmentId);
    const parseResult = completeAssignmentSchema.safeParse(req.body);
    if (assignmentId === null || !parseResult.success) {
      res.status(400).json({ error: 'A valid outcome is required' });
      return;
    }

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
      include: { arbitrators: true },
    });
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    if (!['ongoing', 'overdue', 'escalated'].includes(assignment.status)) {
      res.status(400).json({ error: `Assignment cannot be completed from status ${assignment.status}` });
      return;
    }

    const sessionUser = req.session.user!;
    const isOwningArbitrator =
      sessionUser.role === 'arbitrator' && Number(assignment.arbitrators.user_id) === sessionUser.id;
    const isStaff = ['admin', 'registrar', 'staff'].includes(sessionUser.role);
    if (!isOwningArbitrator && !isStaff) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { outcome, outcomeDetail, awardChallenged } = parseResult.data;
    const now = new Date();

    await prisma.$transaction([
      prisma.assignments.update({
        where: { id: assignmentId },
        data: { status: 'completed', completed_at: now },
      }),
      prisma.cases.update({
        where: { id: assignment.case_id },
        data: {
          status: 'concluded',
          concluded_at: now,
          outcome,
          outcome_detail: outcomeDetail,
          award_challenged: awardChallenged ?? false,
        },
      }),
    ]);

    const scoreResult = await recalculateArbitratorScore(Number(assignment.arbitrator_id), Number(assignment.case_id));

    await logAudit({
      userId: sessionUser.id,
      action: 'assignment_completed',
      entityType: 'assignment',
      entityId: assignmentId,
      metadata: { outcome, newScore: scoreResult.score },
      ipAddress: req.ip,
    });

    res.json({ message: 'Assignment completed', score: scoreResult });
  } catch (error) {
    next(error);
  }
});

const withdrawSchema = z.object({
  reason: z.string().min(1).max(500),
});

/** Pulls an arbitrator off a case before completion - e.g. a conflict surfaces mid-case. */
assignmentRoutes.post(
  '/:assignmentId/withdraw',
  requireRole('admin', 'registrar', 'staff'),
  async (req, res, next) => {
    try {
      const assignmentId = parseId(req.params.assignmentId);
      const parseResult = withdrawSchema.safeParse(req.body);
      if (assignmentId === null || !parseResult.success) {
        res.status(400).json({ error: 'reason is required' });
        return;
      }

      const assignment = await prisma.assignments.findUnique({ where: { id: assignmentId } });
      if (!assignment || !['ongoing', 'overdue', 'escalated'].includes(assignment.status)) {
        res.status(404).json({ error: 'No active assignment found' });
        return;
      }

      await prisma.$transaction([
        prisma.assignments.update({
          where: { id: assignmentId },
          data: { status: 'withdrawn', withdrawal_reason: parseResult.data.reason },
        }),
        prisma.cases.update({
          where: { id: assignment.case_id },
          data: { status: 'pending_assignment', due_date: null },
        }),
      ]);

      await logAudit({
        userId: req.session.user!.id,
        action: 'assignment_withdrawn',
        entityType: 'assignment',
        entityId: assignmentId,
        metadata: { reason: parseResult.data.reason },
        ipAddress: req.ip,
      });

      res.json({ message: 'Arbitrator withdrawn from case' });
    } catch (error) {
      next(error);
    }
  },
);
