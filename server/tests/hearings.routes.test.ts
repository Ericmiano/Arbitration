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

describe('hearings', () => {
  it('lets staff schedule a hearing and notifies the assigned arbitrator', async () => {
    const { user: admin, password } = await createUser('admin');
    const claimant = await createParty('Claimant Co');
    const respondent = await createParty('Respondent Co');
    const caseRecord = await createCase({
      createdBy: admin.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });
    const arbitrator = await createArbitrator('Jane Arbitrator');
    await prisma.assignments.create({
      data: {
        case_id: caseRecord.id,
        arbitrator_id: arbitrator.id,
        assigned_by: admin.id,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing',
      },
    });

    const agent = await agentFor(admin, password);
    const res = await agent
      .post('/api/hearings')
      .send({
        caseId: caseRecord.id.toString(),
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        mode: 'virtual',
        venueOrLink: 'https://meet.example.com/hearing',
      })
      .expect(201);

    expect(res.body.status).toBe('scheduled');

    const notifications = await prisma.notifications.findMany({ where: { user_id: arbitrator.user_id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('hearing_scheduled');
  });

  it('rejects scheduling from a party account', async () => {
    const { user: admin } = await createUser('admin');
    const claimant = await createParty('Claimant Co');
    const respondent = await createParty('Respondent Co');
    const caseRecord = await createCase({
      createdBy: admin.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });
    const { user: partyUser, password } = await createUser('party', { email: 'party@test.local' });

    const agent = await agentFor(partyUser, password);
    const res = await agent.post('/api/hearings').send({
      caseId: caseRecord.id.toString(),
      scheduledAt: new Date().toISOString(),
      venueOrLink: 'Room 1',
    });
    expect(res.status).toBe(403);
  });

  it("does not let a party on one case see another case's hearings", async () => {
    const { user: admin, password: adminPassword } = await createUser('admin');

    const partyA = await createParty('Party A');
    const partyAUser = await createUser('party', { email: 'party-a@test.local' });
    await prisma.parties.update({ where: { id: partyA.id }, data: { user_id: partyAUser.user.id } });
    const respondentA = await createParty('Respondent A');
    await createCase({
      createdBy: admin.id,
      claimantId: partyA.id,
      respondentId: respondentA.id,
      disputeValue: 1_000_000,
    });

    const partyB = await createParty('Party B');
    const respondentB = await createParty('Respondent B');
    const caseB = await createCase({
      createdBy: admin.id,
      claimantId: partyB.id,
      respondentId: respondentB.id,
      disputeValue: 1_000_000,
    });

    const adminAgent = await agentFor(admin, adminPassword);
    await adminAgent
      .post('/api/hearings')
      .send({ caseId: caseB.id.toString(), scheduledAt: new Date().toISOString(), venueOrLink: 'Room B' })
      .expect(201);

    const partyAgent = await agentFor(partyAUser.user, partyAUser.password);
    const listRes = await partyAgent.get('/api/hearings').expect(200);
    expect(listRes.body).toHaveLength(0);

    const scopedRes = await partyAgent.get('/api/hearings').query({ caseId: caseB.id.toString() });
    expect(scopedRes.status).toBe(403);
  });

  it('notifies participants and marks status on cancellation', async () => {
    const { user: admin, password } = await createUser('admin');
    const claimant = await createParty('Claimant Co');
    const respondent = await createParty('Respondent Co');
    const caseRecord = await createCase({
      createdBy: admin.id,
      claimantId: claimant.id,
      respondentId: respondent.id,
      disputeValue: 1_000_000,
    });

    const agent = await agentFor(admin, password);
    const created = await agent
      .post('/api/hearings')
      .send({ caseId: caseRecord.id.toString(), scheduledAt: new Date().toISOString(), venueOrLink: 'Room 1' })
      .expect(201);

    const cancelled = await agent
      .patch(`/api/hearings/${created.body.id}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });
});
