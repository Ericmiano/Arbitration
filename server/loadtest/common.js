import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
const EMAIL = __ENV.K6_EMAIL;
const PASSWORD = __ENV.K6_PASSWORD;

/**
 * Logs in a fresh virtual user and returns the session cookie jar's Cookie
 * header value, ready to attach to subsequent requests. Each VU calls this
 * once in its own `setup`-adjacent init, mirroring one real browser session
 * rather than sharing a single cookie across every simulated user.
 */
export function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set K6_EMAIL and K6_PASSWORD to a seeded staging account before running this.');
  }

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(res, {
    'login succeeded': (r) => r.status === 200,
  });

  const cookies = res.headers['Set-Cookie'];
  if (!cookies) {
    throw new Error(`Login did not return a session cookie (status ${res.status}): ${res.body}`);
  }
  return cookies.split(';')[0];
}

export function authHeaders(cookie) {
  return { headers: { Cookie: cookie } };
}
