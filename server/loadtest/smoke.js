// Smoke test: the bare minimum "does it work" check. Run this before any of
// the heavier tests in this directory - if this fails, ramp/spike/soak
// results are meaningless.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, login, authHeaders } from './common.js';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health check is 200': (r) => r.status === 200 });

  const cookie = login();

  const cases = http.get(`${BASE_URL}/api/cases`, authHeaders(cookie));
  check(cases, { 'cases list is 200': (r) => r.status === 200 });

  sleep(1);
}
