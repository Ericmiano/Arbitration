import { prisma } from '../lib/prisma';

const WEIGHTS = {
  timeliness: 0.45,
  outcome: 0.4,
  workload: 0.15,
};

const NEUTRAL_BASELINE = 70;
const MIN_CASES_FOR_REAL_SCORE = 3;
const ROLLING_WINDOW = 10; // most recent N score-history rows feed the displayed score

function timelinessScoreForAssignment(assignment: {
  due_date: Date;
  completed_at: Date | null;
  assignment_extensions: Array<{ status: string }>;
}): number {
  if (!assignment.completed_at) return 100; // shouldn't happen for a "completed" filter, but stay safe
  const hadApprovedExtension = assignment.assignment_extensions.some((e) => e.status === 'approved');
  const completedLate = assignment.completed_at.getTime() > assignment.due_date.getTime();

  if (!completedLate && !hadApprovedExtension) return 100;
  if (!completedLate && hadApprovedExtension) return 80;
  if (completedLate && hadApprovedExtension) return 50;
  return 20;
}

function outcomeScoreForCase(caseRecord: {
  outcome: string | null;
  award_challenged: boolean | null;
}): number {
  switch (caseRecord.outcome) {
    case 'award_issued':
      return caseRecord.award_challenged ? 40 : 100;
    case 'settled':
      return 85;
    case 'withdrawn':
      return 60;
    default:
      return 70; // outcome not recorded yet - neutral, shouldn't normally happen at recalculation time
  }
}

/**
 * Recalculates and persists an arbitrator's score after one of their cases
 * closes. `triggeringCaseId` is recorded on the arbitrator_score_history row
 * for traceability but the score itself is computed from the arbitrator's
 * full assignment history (bounded to a rolling window - see ROLLING_WINDOW).
 */
export async function recalculateArbitratorScore(arbitratorId: number, triggeringCaseId: number) {
  const arbitrator = await prisma.arbitrators.findUniqueOrThrow({
    where: { id: arbitratorId },
  });

  const allAssignments = await prisma.assignments.findMany({
    where: { arbitrator_id: arbitratorId },
    include: {
      cases: { select: { outcome: true, award_challenged: true } },
      assignment_extensions: { select: { status: true } },
    },
  });

  const completedAssignments = allAssignments.filter(
    (a) => a.status === 'completed' && a.completed_at !== null,
  );
  const withdrawnOrReassigned = allAssignments.filter(
    (a) => a.status === 'withdrawn' || a.status === 'reassigned',
  );

  const timelinessScore =
    completedAssignments.length === 0
      ? NEUTRAL_BASELINE
      : average(completedAssignments.map((a) => timelinessScoreForAssignment(a)));

  const outcomeScore =
    completedAssignments.length === 0
      ? NEUTRAL_BASELINE
      : average(completedAssignments.map((a) => outcomeScoreForCase(a.cases)));

  const settledCount = completedAssignments.length + withdrawnOrReassigned.length;
  const workloadScore =
    settledCount === 0 ? 100 : (completedAssignments.length / settledCount) * 100;

  const rawScore =
    WEIGHTS.timeliness * timelinessScore +
    WEIGHTS.outcome * outcomeScore +
    WEIGHTS.workload * workloadScore;

  const newCasesClosedCount = arbitrator.cases_closed_count + 1;

  await prisma.arbitrator_score_history.create({
    data: {
      arbitrator_id: arbitratorId,
      case_id: triggeringCaseId,
      score: round2(rawScore),
      timeliness_component: round2(timelinessScore),
      outcome_component: round2(outcomeScore),
      workload_component: round2(workloadScore),
    },
  });

  let displayedScore = Number(arbitrator.score);
  if (newCasesClosedCount >= MIN_CASES_FOR_REAL_SCORE) {
    const recentHistory = await prisma.arbitrator_score_history.findMany({
      where: { arbitrator_id: arbitratorId },
      orderBy: { calculated_at: 'desc' },
      take: ROLLING_WINDOW,
      select: { score: true },
    });
    displayedScore = round2(average(recentHistory.map((h) => Number(h.score))));
  }

  await prisma.arbitrators.update({
    where: { id: arbitratorId },
    data: {
      cases_closed_count: newCasesClosedCount,
      score: displayedScore,
      score_updated_at: new Date(),
    },
  });

  return { score: displayedScore, timelinessScore, outcomeScore, workloadScore };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
