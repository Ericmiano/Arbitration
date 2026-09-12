import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { createUser } from './helpers/fixtures';

const app = createApp();

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/login', () => {
  it('rejects an unknown email with a generic error (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('rejects a wrong password with the same generic error', async () => {
    const { user } = await createUser('admin', { email: 'admin@test.local', password: 'CorrectHorse1!' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('logs in with correct credentials and establishes a session', async () => {
    const { user, password } = await createUser('admin', { email: 'admin2@test.local' });
    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ email: user.email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('admin');

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.role).toBe('admin');
  });

  it('locks the account after 5 failed attempts', async () => {
    const { user } = await createUser('admin', { email: 'lockout@test.local', password: 'CorrectHorse1!' });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'CorrectHorse1!' }); // even the RIGHT password now
    expect(res.status).toBe(423);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
