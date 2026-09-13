import { prisma } from '../lib/prisma';
import { notifyUsers } from '../services/notify.service';

/**
 * Scans ongoing assignments against their case's SLA thresholds and:
 *  - notifies the arbitrator + staff when a due date is approaching
 *  - marks an assignment 'overdue' once its due date has passed
 *  - marks it 'escalated' (and notifies registrars/admins) once overdue by
 *    the tier's escalation_days_after
 *
 * Intended to run on a schedule via cPanel Cron Job hitting
 * `node dist/jobs/flagOverdueAssignments.js` (see package.json "job:overdue").
 * Notifications are de-duplicated by checking for an existing unread
 * notification of the same type for the same assignment within the last day.
 */
export async function flagOverdueAssignments() {
  const now = new Date();

  // Must include 'overdue' as well as 'ongoing' - otherwise an assignment that
  // already flipped to overdue would drop out of every future scan and could
  // never progress to 'escalated'.
  const activeAssignments = await prisma.assignments.findMany({
    where: { status: { in: ['ongoing', 'overdue'] } },
    include: {
      cases: { select: { id: true, case_number: true, sla_tier: true, currency: true } },
      arbitrators: { select: { user_id: true } },
    },
  });

  const slaConfigs = await prisma.sla_config.findMany();
  const configFor = (tier: string, currency: string) =>
    slaConfigs.find((c) => c.tier === tier && c.currency === currency);

  const registrarStaffIds = (
    await prisma.users.findMany({
      where: { role: { in: ['admin', 'registrar'] }, status: 'active' },
      select: { id: true },
    })
  ).map((u) => u.id);

  let approaching = 0;
  let overdue = 0;
  let escalated = 0;

  for (const assignment of activeAssignments) {
    const config = configFor(assignment.cases.sla_tier, assignment.cases.currency);
    if (!config) continue;

    const daysUntilDue = diffInDays(assignment.due_date, now);

    if (daysUntilDue < 0) {
      const daysOverdue = -daysUntilDue;
      if (daysOverdue >= Number(config.escalation_days_after)) {
        if (assignment.status !== 'escalated') {
          await prisma.assignments.update({
            where: { id: assignment.id },
            data: { status: 'escalated' },
          });
          await notifyOnce(
            registrarStaffIds,
            'case_escalated',
            'assignment',
            assignment.id,
            `Case ${assignment.cases.case_number} is ${daysOverdue} days overdue and needs registrar attention.`,
          );
          escalated += 1;
        }
      } else {
        await prisma.assignments.update({
          where: { id: assignment.id },
          data: { status: 'overdue' },
        });
        await notifyOnce(
          [assignment.arbitrators.user_id, ...registrarStaffIds],
          'case_overdue',
          'assignment',
          assignment.id,
          `Case ${assignment.cases.case_number} is overdue (due ${assignment.due_date.toDateString()}).`,
        );
        overdue += 1;
      }
    } else if (daysUntilDue <= Number(config.approaching_days_before)) {
      await notifyOnce(
        [assignment.arbitrators.user_id],
        'case_approaching_due',
        'assignment',
        assignment.id,
        `Case ${assignment.cases.case_number} is due in ${daysUntilDue} day(s).`,
      );
      approaching += 1;
    }
  }

  return { scanned: activeAssignments.length, approaching, overdue, escalated };
}

function diffInDays(due: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((due.getTime() - now.getTime()) / msPerDay);
}

async function notifyOnce(
  userIds: bigint[],
  type: string,
  relatedEntityType: string,
  relatedEntityId: bigint,
  message: string,
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const userId of userIds) {
    const existing = await prisma.notifications.findFirst({
      where: {
        user_id: userId,
        type,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        created_at: { gte: since },
      },
    });
    if (existing) continue;

    await notifyUsers([Number(userId)], type, relatedEntityType, Number(relatedEntityId), message);
  }
}

// CLI entry point for cron - only runs when this file is executed directly,
// not when recalculateArbitratorScore-style imports pull in the function.
if (require.main === module) {
  flagOverdueAssignments()
    .then((result) => {
      console.log('Overdue scan complete:', result);
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error('Overdue scan failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
