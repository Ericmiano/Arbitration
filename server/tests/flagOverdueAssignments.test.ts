import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { flagOverdueAssignments } from '../src/jobs/flagOverdueAssignments';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { createArbitrator, createCase, createParty, createUser } from './helpers/fixtures';

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

async function ongoingAssignment(daysUntilDue: number) {
  const { user } = await createUser('admin');
  const claimant = await createParty('Claimant');
  const respondent = await createParty('Respondent');
  const arbitrator = await createArbitrator('Overdue Test Arbitrator');
  const caseRecord = await createCase({
    createdBy: user.id,
    claimantId: claimant.id,
    respondentId: respondent.id,
    disputeValue: 1_000_000,
  });
  const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);
  const assignment = await prisma.assignments.create({
    data: {
      case_id: caseRecord.id,
      arbitrator_id: arbitrator.id,
      assigned_by: user.id,
      due_date: dueDate,
      status: 'ongoing',
    },
  });
  return { assignment, caseRecord };
}

describe('flagOverdueAssignments', () => {
  it('flags an assignment overdue once its due date has passed', async () => {
    const { assignment } = await ongoingAssignment(-5);
    const result = await flagOverdueAssignments();
    expect(result.overdue).toBe(1);

    const updated = await prisma.assignments.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe('overdue');
  });

  it('escalates an assignment that is overdue past the escalation threshold', async () => {
    const { assignment } = await ongoingAssignment(-35); // simple tier: escalation_days_after = 30
    const result = await flagOverdueAssignments();
    expect(result.escalated).toBe(1);

    const updated = await prisma.assignments.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe('escalated');
  });

  it('regression: an already-overdue assignment is still re-scanned and can progress to escalated', async () => {
    const { assignment } = await ongoingAssignment(-5);

    const firstScan = await flagOverdueAssignments();
    expect(firstScan.overdue).toBe(1);
    let updated = await prisma.assignments.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe('overdue');

    // Push it further overdue and confirm the SECOND scan still picks it up -
    // this is the bug that shipped once: the job only queried status='ongoing',
    // so anything already flagged overdue silently stopped being monitored.
    await prisma.assignments.update({
      where: { id: assignment.id },
      data: { due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) },
    });

    const secondScan = await flagOverdueAssignments();
    expect(secondScan.scanned).toBe(1);
    expect(secondScan.escalated).toBe(1);

    updated = await prisma.assignments.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe('escalated');
  });

  it('does not touch an assignment that is not yet due', async () => {
    const { assignment } = await ongoingAssignment(30);
    await flagOverdueAssignments();
    const updated = await prisma.assignments.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe('ongoing');
  });
});
