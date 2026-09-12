import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { recalculateArbitratorScore } from '../src/services/scoring.service';
import { truncateAll } from './helpers/db';
import { createArbitrator, createCase, createParty, createUser } from './helpers/fixtures';

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

async function completedOnTimeCase(arbitratorId: bigint, createdBy: bigint, claimantId: bigint, respondentId: bigint) {
  const caseRecord = await createCase({ createdBy, claimantId, respondentId, disputeValue: 1_000_000 });
  const now = new Date();
  const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  await prisma.cases.update({
    where: { id: caseRecord.id },
    data: { status: 'concluded', outcome: 'award_issued', award_challenged: false, concluded_at: now },
  });

  const assignment = await prisma.assignments.create({
    data: {
      case_id: caseRecord.id,
      arbitrator_id: arbitratorId,
      assigned_by: createdBy,
      due_date: dueDate,
      status: 'completed',
      completed_at: now,
    },
  });

  return { caseRecord, assignment };
}

describe('scoring.service', () => {
  it('keeps the neutral baseline score until 3 cases have closed', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant');
    const respondent = await createParty('Respondent');
    const arbitrator = await createArbitrator('Score Test Arbitrator');

    const { caseRecord: case1 } = await completedOnTimeCase(arbitrator.id, user.id, claimant.id, respondent.id);
    await recalculateArbitratorScore(Number(arbitrator.id), Number(case1.id));

    let updated = await prisma.arbitrators.findUniqueOrThrow({ where: { id: arbitrator.id } });
    expect(Number(updated.score)).toBe(70); // baseline, 1 of 3 needed
    expect(updated.cases_closed_count).toBe(1);

    const { caseRecord: case2 } = await completedOnTimeCase(arbitrator.id, user.id, claimant.id, respondent.id);
    await recalculateArbitratorScore(Number(arbitrator.id), Number(case2.id));

    updated = await prisma.arbitrators.findUniqueOrThrow({ where: { id: arbitrator.id } });
    expect(Number(updated.score)).toBe(70); // baseline, 2 of 3 needed
  });

  it('switches to the computed rolling score once 3 cases have closed', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant');
    const respondent = await createParty('Respondent');
    const arbitrator = await createArbitrator('Score Test Arbitrator 2');

    let lastCaseId = 0n;
    for (let i = 0; i < 3; i += 1) {
      const { caseRecord } = await completedOnTimeCase(arbitrator.id, user.id, claimant.id, respondent.id);
      lastCaseId = caseRecord.id;
      await recalculateArbitratorScore(Number(arbitrator.id), Number(caseRecord.id));
    }

    const updated = await prisma.arbitrators.findUniqueOrThrow({ where: { id: arbitrator.id } });
    // All 3 cases were on-time, unchallenged awards, no withdrawals -> every
    // component is 100, so the composite and rolling average are both 100.
    expect(Number(updated.score)).toBe(100);
    expect(updated.cases_closed_count).toBe(3);

    const history = await prisma.arbitrator_score_history.findMany({
      where: { arbitrator_id: arbitrator.id },
    });
    expect(history).toHaveLength(3);
    for (const row of history) {
      expect(Number(row.timeliness_component)).toBe(100);
      expect(Number(row.outcome_component)).toBe(100);
      expect(Number(row.workload_component)).toBe(100);
    }
    expect(lastCaseId).not.toBe(0n);
  });

  it('penalizes a late completion without an approved extension', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant');
    const respondent = await createParty('Respondent');
    const arbitrator = await createArbitrator('Late Arbitrator');

    const caseRecord = await createCase({
      createdBy: user.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });
    const now = new Date();
    const pastDueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    await prisma.cases.update({
      where: { id: caseRecord.id },
      data: { status: 'concluded', outcome: 'award_issued', award_challenged: false },
    });
    await prisma.assignments.create({
      data: {
        case_id: caseRecord.id,
        arbitrator_id: arbitrator.id,
        assigned_by: user.id,
        due_date: pastDueDate,
        status: 'completed',
        completed_at: now,
      },
    });

    const result = await recalculateArbitratorScore(Number(arbitrator.id), Number(caseRecord.id));
    expect(result.timelinessScore).toBe(20); // late, no extension
    expect(result.outcomeScore).toBe(100); // unchallenged award
  });
});
