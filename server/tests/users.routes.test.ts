import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { createArbitrator, createUser } from './helpers/fixtures';

const app = createApp();

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

async function agentFor(user: { email: string }, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);
  return agent;
}

describe('POST /api/users', () => {
  it('lets an admin create a new staff account and sends a setup link', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'creator@test.local' });
    const agent = await agentFor(admin, password);

    const res = await agent
      .post('/api/users')
      .send({ email: 'newstaff@test.local', fullName: 'New Staff Member', role: 'staff' })
      .expect(201);
    expect(res.body.role).toBe('staff');

    const created = await prisma.users.findUniqueOrThrow({ where: { email: 'newstaff@test.local' } });
    const tokens = await prisma.password_reset_tokens.findMany({ where: { user_id: created.id } });
    expect(tokens).toHaveLength(1);
  });

  it('rejects creating a duplicate email', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'creator2@test.local' });
    await createUser('staff', { email: 'dupe@test.local' });
    const agent = await agentFor(admin, password);

    const res = await agent.post('/api/users').send({ email: 'dupe@test.local', fullName: 'Dupe', role: 'staff' });
    expect(res.status).toBe(409);
  });

  it('rejects account creation from a non-admin', async () => {
    const { user: staff, password } = await createUser('staff', { email: 'creator3@test.local' });
    const agent = await agentFor(staff, password);

    const res = await agent.post('/api/users').send({ email: 'blocked@test.local', fullName: 'Blocked', role: 'staff' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:userId', () => {
  it('lets an admin change another staff account role and status', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'admin@test.local' });
    const { user: staff } = await createUser('staff', { email: 'staff@test.local' });

    const agent = await agentFor(admin, password);
    const res = await agent.patch(`/api/users/${staff.id}`).send({ role: 'registrar' }).expect(200);
    expect(res.body.role).toBe('registrar');
  });

  it('rejects role edits from a non-admin staff account', async () => {
    const { user: registrar, password } = await createUser('registrar', { email: 'registrar@test.local' });
    const { user: staff } = await createUser('staff', { email: 'staff2@test.local' });

    const agent = await agentFor(registrar, password);
    const res = await agent.patch(`/api/users/${staff.id}`).send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it("refuses to let an admin change their own role", async () => {
    const { user: admin, password } = await createUser('admin', { email: 'admin2@test.local' });
    const agent = await agentFor(admin, password);
    const res = await agent.patch(`/api/users/${admin.id}`).send({ role: 'staff' });
    expect(res.status).toBe(400);
  });

  it('allows demoting one of two admins, leaving the other active', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'admin4@test.local' });
    const { user: secondAdmin } = await createUser('admin', { email: 'secondadmin@test.local' });

    const agent = await agentFor(admin, password);
    const res = await agent.patch(`/api/users/${secondAdmin.id}`).send({ role: 'staff' }).expect(200);
    expect(res.body.role).toBe('staff');
  });

  it('rejects editing an arbitrator or party account through this endpoint', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'admin3@test.local' });
    const arbitrator = await createArbitrator('Some Arbitrator');

    const agent = await agentFor(admin, password);
    const res = await agent.patch(`/api/users/${arbitrator.user_id}`).send({ role: 'staff' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/audit-logs', () => {
  it('is admin-only', async () => {
    const { user: staff, password } = await createUser('staff', { email: 'auditstaff@test.local' });
    const agent = await agentFor(staff, password);
    const res = await agent.get('/api/audit-logs');
    expect(res.status).toBe(403);
  });

  it('lists events for an admin, including the login that just happened', async () => {
    const { user: admin, password } = await createUser('admin', { email: 'auditadmin@test.local' });
    const agent = await agentFor(admin, password);
    const res = await agent.get('/api/audit-logs').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((log: { action: string }) => log.action === 'login')).toBe(true);
  });
});
