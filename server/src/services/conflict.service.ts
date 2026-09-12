import { prisma } from '../lib/prisma';

export interface ConflictCheckResult {
  blocked: boolean;
  declaredConflicts: Array<{ reason: string; partyId: number | null; organizationId: number | null }>;
  priorEngagements: Array<{ caseId: number; caseNumber: string; partyId: number }>;
}

/**
 * Checks an arbitrator against a case's parties/organizations.
 *  - `declaredConflicts`: the arbitrator (or staff) explicitly declared this
 *    party/org as a conflict - this blocks assignment outright.
 *  - `priorEngagements`: the arbitrator has arbitrated a case involving one of
 *    these parties before - NOT a block, just a signal for staff to review,
 *    since name/party matches alone aren't reliable enough to auto-exclude.
 */
export async function checkConflicts(
  arbitratorId: number,
  caseId: number,
): Promise<ConflictCheckResult> {
  const caseParties = await prisma.case_parties.findMany({
    where: { case_id: caseId },
    include: { parties: { select: { id: true, organization_id: true } } },
  });

  const partyIds = caseParties.map((cp) => cp.parties.id);
  const organizationIds = caseParties
    .map((cp) => cp.parties.organization_id)
    .filter((id): id is bigint => id !== null);

  const today = new Date();

  const declared = await prisma.arbitrator_conflicts.findMany({
    where: {
      arbitrator_id: arbitratorId,
      OR: [
        { conflicted_party_id: { in: partyIds } },
        { conflicted_organization_id: { in: organizationIds } },
      ],
      AND: [{ OR: [{ expires_at: null }, { expires_at: { gte: today } }] }],
    },
  });

  const priorCaseParties = await prisma.case_parties.findMany({
    where: {
      party_id: { in: partyIds },
      case_id: { not: caseId },
      cases: {
        assignments: { some: { arbitrator_id: arbitratorId } },
      },
    },
    include: { cases: { select: { id: true, case_number: true } } },
  });

  return {
    blocked: declared.length > 0,
    declaredConflicts: declared.map((c) => ({
      reason: c.reason,
      partyId: c.conflicted_party_id === null ? null : Number(c.conflicted_party_id),
      organizationId:
        c.conflicted_organization_id === null ? null : Number(c.conflicted_organization_id),
    })),
    priorEngagements: priorCaseParties.map((cp) => ({
      caseId: Number(cp.cases.id),
      caseNumber: cp.cases.case_number,
      partyId: Number(cp.party_id),
    })),
  };
}
