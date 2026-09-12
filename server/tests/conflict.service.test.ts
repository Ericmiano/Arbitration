import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { checkConflicts } from '../src/services/conflict.service';
import { truncateAll } from './helpers/db';
import { createArbitrator, createCase, createParty, createUser } from './helpers/fixtures';

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('conflict.service', () => {
  it('does not block when there is no declared conflict or history', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant A');
    const respondent = await createParty('Respondent A');
    const arbitrator = await createArbitrator('Arb A');
    const caseRecord = await createCase({
      createdBy: user.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });

    const result = await checkConflicts(Number(arbitrator.id), Number(caseRecord.id));
    expect(result.blocked).toBe(false);
    expect(result.declaredConflicts).toHaveLength(0);
    expect(result.priorEngagements).toHaveLength(0);
  });

  it('blocks when the arbitrator has a declared conflict against a case party', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant B');
    const respondent = await createParty('Respondent B');
    const arbitrator = await createArbitrator('Arb B');
    const caseRecord = await createCase({
      createdBy: user.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });

    await prisma.arbitrator_conflicts.create({
      data: {
        arbitrator_id: arbitrator.id,
        conflicted_party_id: claimant.id,
        reason: 'Previously represented this party',
      },
    });

    const result = await checkConflicts(Number(arbitrator.id), Number(caseRecord.id));
    expect(result.blocked).toBe(true);
    expect(result.declaredConflicts).toHaveLength(1);
  });

  it('does not block an expired declared conflict, but still flags prior engagement', async () => {
    const { user } = await createUser('admin');
    const claimant = await createParty('Claimant C');
    const respondent = await createParty('Respondent C');
    const arbitrator = await createArbitrator('Arb C');

    const pastCase = await createCase({
      createdBy: user.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });
    await prisma.assignments.create({
      data: {
        case_id: pastCase.id,
        arbitrator_id: arbitrator.id,
        assigned_by: user.id,
        due_date: new Date(),
        status: 'completed',
        completed_at: new Date(),
      },
    });

    await prisma.arbitrator_conflicts.create({
      data: {
        arbitrator_id: arbitrator.id,
        conflicted_party_id: claimant.id,
        reason: 'Old conflict, no longer applicable',
        expires_at: new Date('2020-01-01'),
      },
    });

    const newCase = await createCase({
      createdBy: user.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 2_000_000,
    });

    const result = await checkConflicts(Number(arbitrator.id), Number(newCase.id));
    expect(result.blocked).toBe(false);
    expect(result.priorEngagements.length).toBeGreaterThan(0);
  });
});
