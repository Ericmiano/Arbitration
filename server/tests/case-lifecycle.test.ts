import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { csrfAgent } from './helpers/csrfAgent';
import { createUser } from './helpers/fixtures';

const app = createApp();

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

async function loginAsAdmin() {
  const { user, password } = await createUser('admin');
  const agent = await csrfAgent(app);
  await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);
  return agent;
}

describe('case lifecycle (end to end through the API)', () => {
  it('creates a case, blocks a conflicted arbitrator, assigns a clean one, and completes it', async () => {
    const agent = await loginAsAdmin();

    const claimant = await agent
      .post('/api/parties')
      .send({ type: 'individual', fullName: 'Jane Claimant' })
      .expect(201);
    const respondent = await agent
      .post('/api/parties')
      .send({ type: 'individual', fullName: 'Bob Respondent' })
      .expect(201);

    const caseRes = await agent
      .post('/api/cases')
      .send({
        disputeValue: 1_000_000,
        currency: 'KES',
        category: 'payment',
        description: 'Test dispute',
        basis: 'mutual_agreement',
        parties: [
          { partyId: claimant.body.id, role: 'claimant' },
          { partyId: respondent.body.id, role: 'respondent' },
        ],
      })
      .expect(201);

    expect(caseRes.body.status).toBe('pending_agreement');
    expect(caseRes.body.sla_tier).toBe('simple');

    // Force the case into pending_assignment directly (skipping the
    // submission-agreement upload flow, which is exercised separately) so we
    // can focus this test on the assignment/conflict/completion path.
    await prisma.cases.update({ where: { id: BigInt(caseRes.body.id) }, data: { status: 'pending_assignment' } });

    const conflictedArb = await agent
      .post('/api/arbitrators')
      .send({ email: 'conflicted@test.local', fullName: 'Conflicted Arbitrator' })
      .expect(201);
    const cleanArb = await agent
      .post('/api/arbitrators')
      .send({ email: 'clean@test.local', fullName: 'Clean Arbitrator' })
      .expect(201);

    await agent
      .post(`/api/arbitrators/${conflictedArb.body.arbitrator.id}/conflicts`)
      .send({ partyId: claimant.body.id, reason: 'Prior relationship' })
      .expect(201);

    const eligibleRes = await agent.get('/api/arbitrators/eligible').query({ caseId: caseRes.body.id }).expect(200);
    const eligibleIds = eligibleRes.body.map((a: { id: string }) => a.id);
    expect(eligibleIds).not.toContain(conflictedArb.body.arbitrator.id);
    expect(eligibleIds).toContain(cleanArb.body.arbitrator.id);

    const blockedAssign = await agent
      .post('/api/assignments')
      .send({ caseId: caseRes.body.id, arbitratorId: conflictedArb.body.arbitrator.id });
    expect(blockedAssign.status).toBe(409);

    const assignRes = await agent
      .post('/api/assignments')
      .send({ caseId: caseRes.body.id, arbitratorId: cleanArb.body.arbitrator.id })
      .expect(201);
    expect(assignRes.body.status).toBe('ongoing');

    const caseAfterAssign = await agent.get(`/api/cases/${caseRes.body.id}`).expect(200);
    expect(caseAfterAssign.body.status).toBe('ongoing');
    expect(caseAfterAssign.body.due_date).not.toBeNull();

    const completeRes = await agent
      .post(`/api/assignments/${assignRes.body.id}/complete`)
      .send({ outcome: 'award_issued', awardChallenged: false })
      .expect(200);
    expect(completeRes.body.score.outcomeScore).toBe(100);

    const caseAfterComplete = await agent.get(`/api/cases/${caseRes.body.id}`).expect(200);
    expect(caseAfterComplete.body.status).toBe('concluded');
    expect(caseAfterComplete.body.outcome).toBe('award_issued');
  });

  it('rejects case creation for a party account (staff-only)', async () => {
    const { user, password } = await createUser('party', { email: 'party@test.local' });
    const agent = await csrfAgent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);

    const res = await agent.post('/api/cases').send({
      disputeValue: 1000,
      currency: 'KES',
      category: 'test',
      description: 'test',
      basis: 'mutual_agreement',
      parties: [
        { partyId: 1, role: 'claimant' },
        { partyId: 2, role: 'respondent' },
      ],
    });
    expect(res.status).toBe(403);
  });
});
