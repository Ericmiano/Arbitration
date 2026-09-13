import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAll } from './helpers/db';
import { createUser } from './helpers/fixtures';

const app = createApp();

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/request-password-reset', () => {
  it('returns the same generic message for an unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/request-password-reset').send({ email: 'nobody@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if that email is registered/i);
  });

  it('creates a reset token for a known, active account', async () => {
    const { user } = await createUser('staff', { email: 'staff@test.local' });
    const res = await request(app).post('/api/auth/request-password-reset').send({ email: user.email });
    expect(res.status).toBe(200);

    const tokens = await prisma.password_reset_tokens.findMany({ where: { user_id: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].used_at).toBeNull();
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'NewPassword123!' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const { user } = await createUser('staff', { email: 'expired@test.local' });
    const token = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.password_reset_tokens.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'NewPassword123!' });
    expect(res.status).toBe(400);
  });

  it('resets the password with a valid token, and the new password logs in', async () => {
    const { user } = await createUser('staff', { email: 'resetme@test.local', password: 'OldPassword123!' });
    const token = 'b'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.password_reset_tokens.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'BrandNewPassword123!' });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'OldPassword123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'BrandNewPassword123!' });
    expect(newLogin.status).toBe(200);
  });

  it('cannot reuse an already-used token', async () => {
    const { user } = await createUser('staff', { email: 'reuse@test.local' });
    const token = 'c'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.password_reset_tokens.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'FirstReset123!' }).expect(200);
    const secondAttempt = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'SecondReset123!' });
    expect(secondAttempt.status).toBe(400);
  });
});
