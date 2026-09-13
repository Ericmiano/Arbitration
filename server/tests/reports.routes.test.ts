import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { csrfAgent } from './helpers/csrfAgent';
import { createArbitrator, createCase, createParty, createUser } from './helpers/fixtures';

const app = createApp();

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

async function agentFor(user: { email: string }, password: string) {
  const agent = await csrfAgent(app);
  await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);
  return agent;
}

describe('GET /api/reports/overview', () => {
  it('is staff-only', async () => {
    const { user, password } = await createUser('arbitrator', { email: 'arb@test.local' });
    const agent = await agentFor(user, password);
    const res = await agent.get('/api/reports/overview');
    expect(res.status).toBe(403);
  });

  it('summarizes case volume, status breakdown, and overdue/workload for staff', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'admin@test.local' });
    const claimant = await createParty('Claimant Co');
    const respondent = await createParty('Respondent Co');
    const caseRecord = await createCase({
      createdBy: admin.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });
    const arbitrator = await createArbitrator('Overdue Arbitrator');
    await prisma.assignments.create({
      data: {
        case_id: caseRecord.id,
        arbitrator_id: arbitrator.id,
        assigned_by: admin.id,
        due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'overdue',
      },
    });

    const agent = await agentFor(admin, password);
    const res = await agent.get('/api/reports/overview').expect(200);

    expect(Array.isArray(res.body.caseVolumeByMonth)).toBe(true);
    expect(Array.isArray(res.body.casesByStatus)).toBe(true);
    expect(res.body.overdue).toHaveLength(1);
    expect(res.body.overdue[0].caseNumber).toBe(caseRecord.case_number);
    expect(res.body.overdue[0].daysOverdue).toBeGreaterThanOrEqual(4);

    const workloadEntry = res.body.arbitratorWorkload.find((a: { id: string }) => a.id === String(arbitrator.id));
    expect(workloadEntry.activeCases).toBe(1);
  });
});

describe('GET /api/cases?q=', () => {
  it('finds a case by case number, description, or party name', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'searchadmin@test.local' });
    const claimant = await createParty('Very Distinctive Claimant Name');
    const respondent = await createParty('Respondent Co');
    const caseRecord = await createCase({
      createdBy: admin.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });

    const agent = await agentFor(admin, password);

    const byNumber = await agent.get('/api/cases').query({ q: caseRecord.case_number }).expect(200);
    expect(byNumber.body).toHaveLength(1);

    const byParty = await agent.get('/api/cases').query({ q: 'Very Distinctive Claimant' }).expect(200);
    expect(byParty.body).toHaveLength(1);

    const noMatch = await agent.get('/api/cases').query({ q: 'nonexistent-search-term-xyz' }).expect(200);
    expect(noMatch.body).toHaveLength(0);
  });

  it('still scopes search results by role (a party only searches within their own cases)', async () => {
    const { user: admin } = await createUser('admin', { email: 'searchadmin2@test.local' });
    const partyA = await createParty('Party A');
    const partyUser = await createUser('party', { email: 'searchparty@test.local' });
    await prisma.parties.update({ where: { id: partyA.id }, data: { user_id: partyUser.user.id } });
    const respondentA = await createParty('Respondent A');
    await createCase({ createdBy: admin.id, claimantId: partyA.id, respondentId: respondentA.id, disputeValue: 1_000_000 });

    const partyB = await createParty('Party B');
    const respondentB = await createParty('Respondent B');
    const caseB = await createCase({ createdBy: admin.id, claimantId: partyB.id, respondentId: respondentB.id, disputeValue: 1_000_000 });

    const partyAgent = await agentFor(partyUser.user, partyUser.password);
    const res = await partyAgent.get('/api/cases').query({ q: caseB.case_number }).expect(200);
    expect(res.body).toHaveLength(0);
  });
});
