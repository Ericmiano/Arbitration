import request from 'supertest';
import type { Express } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../../src/middleware/csrf';

/**
 * The app now requires a matching X-CSRF-Token header on every mutating
 * request (double-submit cookie pattern - see middleware/csrf.ts). A real
 * browser session picks the cookie up automatically and the frontend's
 * axios interceptor echoes it back; supertest has no such interceptor, so
 * every test that POSTs/PATCHes/DELETEs needs an agent that does the same
 * thing. Fetches the cookie with one throwaway GET, then patches the
 * agent's mutating methods to always attach it - so call sites don't need
 * to change beyond how the agent itself is created.
 */
export async function csrfAgent(app: Express): Promise<request.SuperAgentTest> {
  const agent = request.agent(app);
  const probe = await agent.get('/api/health');
  const setCookie = (probe.headers['set-cookie'] ?? []) as unknown as string[];
  const match = setCookie.map(String).find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  const token = match ? match.split(';')[0].split('=')[1] : '';

  (['post', 'patch', 'put', 'delete'] as const).forEach((method) => {
    const original = agent[method].bind(agent);
    agent[method] = ((url: string) => original(url).set(CSRF_HEADER, token)) as typeof agent[typeof method];
  });

  return agent;
}
