import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { parseId } from '../lib/parseId';
import { idSchema } from '../lib/zodId';
import { LIST_HARD_CAP } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware/auth';
import { accessibleCaseIds, canAccessCase } from '../services/caseAccess.service';
import { logAudit } from '../services/audit.service';
import { caseParticipantUserIds, notifyUsers } from '../services/notify.service';

export const hearingRoutes = Router();

hearingRoutes.use(requireAuth);

hearingRoutes.get('/', async (req, res, next) => {
  try {
    const sessionUser = req.session.user!;
    const caseIdParam = req.query.caseId as string | undefined;

    let caseIds: number[];
    if (caseIdParam) {
      const caseId = parseId(caseIdParam);
      if (caseId === null) {
        res.status(400).json({ error: 'Invalid case id' });
        return;
      }
      if (!(await canAccessCase(caseId, sessionUser))) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      caseIds = [caseId];
    } else {
      caseIds = await accessibleCaseIds(sessionUser);
    }

    const hearings = await prisma.hearings.findMany({
      where: { case_id: { in: caseIds } },
      include: { cases: { select: { id: true, case_number: true } } },
      orderBy: { scheduled_at: 'asc' },
      take: LIST_HARD_CAP,
    });

    res.json(hearings);
  } catch (error) {
    next(error);
  }
});

const createHearingSchema = z.object({
  caseId: idSchema,
  scheduledAt: z.coerce.date(),
  mode: z.enum(['in_person', 'virtual']).default('in_person'),
  venueOrLink: z.string().min(1).max(500),
  agenda: z.string().max(5000).optional(),
  requiredDocuments: z.string().max(2000).optional(),
});

hearingRoutes.post('/', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const parseResult = createHearingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }
    const input = parseResult.data;

    const caseRecord = await prisma.cases.findUnique({ where: { id: input.caseId } });
    if (!caseRecord) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    const hearing = await prisma.hearings.create({
      data: {
        case_id: input.caseId,
        scheduled_at: input.scheduledAt,
        mode: input.mode,
        venue_or_link: input.venueOrLink,
        agenda: input.agenda,
        required_documents: input.requiredDocuments,
        scheduled_by: req.session.user!.id,
      },
    });

    await logAudit({
      userId: req.session.user!.id,
      action: 'hearing_scheduled',
      entityType: 'hearing',
      entityId: hearing.id,
      metadata: { caseId: input.caseId, scheduledAt: input.scheduledAt },
      ipAddress: req.ip,
    });

    const participants = await caseParticipantUserIds(input.caseId);
    await notifyUsers(
      participants,
      'hearing_scheduled',
      'hearing',
      Number(hearing.id),
      `A hearing has been scheduled for ${caseRecord.case_number} on ${input.scheduledAt.toLocaleString()}.`,
    );

    res.status(201).json(hearing);
  } catch (error) {
    next(error);
  }
});

const updateHearingSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  mode: z.enum(['in_person', 'virtual']).optional(),
  venueOrLink: z.string().min(1).max(500).optional(),
  agenda: z.string().max(5000).optional(),
  requiredDocuments: z.string().max(2000).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'postponed']).optional(),
});

hearingRoutes.patch('/:hearingId', requireRole('admin', 'registrar', 'staff'), async (req, res, next) => {
  try {
    const hearingId = parseId(req.params.hearingId);
    const parseResult = updateHearingSchema.safeParse(req.body);
    if (hearingId === null || !parseResult.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    const input = parseResult.data;

    const existing = await prisma.hearings.findUnique({ where: { id: hearingId }, include: { cases: true } });
    if (!existing) {
      res.status(404).json({ error: 'Hearing not found' });
      return;
    }

    const isReschedule =
      (input.scheduledAt && input.scheduledAt.getTime() !== existing.scheduled_at.getTime()) ||
      (input.venueOrLink && input.venueOrLink !== existing.venue_or_link);
    const isCancellation = input.status === 'cancelled' && existing.status !== 'cancelled';

    const updated = await prisma.hearings.update({
      where: { id: hearingId },
      data: {
        scheduled_at: input.scheduledAt,
        mode: input.mode,
        venue_or_link: input.venueOrLink,
        agenda: input.agenda,
        required_documents: input.requiredDocuments,
        status: input.status,
      },
    });

    await logAudit({
      userId: req.session.user!.id,
      action: 'hearing_updated',
      entityType: 'hearing',
      entityId: hearingId,
      metadata: { changes: input },
      ipAddress: req.ip,
    });

    if (isReschedule || isCancellation) {
      const participants = await caseParticipantUserIds(Number(existing.case_id));
      const message = isCancellation
        ? `The hearing scheduled for ${existing.cases.case_number} has been cancelled.`
        : `The hearing for ${existing.cases.case_number} has been rescheduled to ${updated.scheduled_at.toLocaleString()}.`;
      await notifyUsers(
        participants,
        isCancellation ? 'hearing_cancelled' : 'hearing_rescheduled',
        'hearing',
        hearingId,
        message,
      );
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});
