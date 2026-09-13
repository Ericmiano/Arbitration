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

// Regression test for a real bug: an ID beyond Number.MAX_SAFE_INTEGER
// (e.g. from a path param or query string) parses to a value like `1e+21`,
// which passes `Number.isInteger()` (no fractional part) but crashes
// Prisma's BigInt coercion with a raw error exposing the full query and
// server file paths. Every ID-accepting endpoint must reject these with a
// clean 400, never let them reach the database layer.
describe('oversized/unsafe IDs are rejected before reaching Prisma', () => {
  it('GET /cases/:id with an unsafe integer returns 400, not a raw Prisma error', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.get('/api/cases/999999999999999999999');
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/PrismaClient|Invalid `prisma|Expected BigInt/i);
  });

  it('GET /arbitrators/eligible?caseId=<unsafe> returns 400, not a raw Prisma error', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.get('/api/arbitrators/eligible').query({ caseId: '999999999999999999999' });
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/PrismaClient|Invalid `prisma|Expected BigInt/i);
  });

  it('POST /assignments with an unsafe arbitratorId returns 400, not a raw Prisma error', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.post('/api/assignments').send({ caseId: 1, arbitratorId: 999999999999999999999 });
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/PrismaClient|Invalid `prisma|Expected BigInt/i);
  });

  it('a merely large-but-safe ID is still just a clean 404, not a crash', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.get('/api/cases/9007199254740991'); // Number.MAX_SAFE_INTEGER
    expect(res.status).toBe(404);
  });
});
