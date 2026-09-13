import { prisma } from '../lib/prisma';

/**
 * Everyone with a personal stake in a case who might have a portal login:
 * the currently active arbitrator and any parties whose account is linked.
 * Staff aren't included - notifications here are about things staff already
 * know because they triggered them.
 */
export async function caseParticipantUserIds(caseId: number): Promise<number[]> {
  const [activeAssignment, caseParties] = await Promise.all([
    prisma.assignments.findFirst({
      where: { case_id: caseId, status: { in: ['ongoing', 'overdue', 'escalated'] } },
      include: { arbitrators: true },
    }),
    prisma.case_parties.findMany({ where: { case_id: caseId }, include: { parties: true } }),
  ]);

  const userIds = new Set<number>();
  if (activeAssignment) userIds.add(Number(activeAssignment.arbitrators.user_id));
  for (const cp of caseParties) {
    if (cp.parties.user_id) userIds.add(Number(cp.parties.user_id));
  }
  return [...userIds];
}

export async function notifyUsers(
  userIds: number[],
  type: string,
  relatedEntityType: string,
  relatedEntityId: number,
  message: string,
): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notifications.createMany({
    data: userIds.map((userId) => ({
      user_id: userId,
      type,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      message,
    })),
  });
}
