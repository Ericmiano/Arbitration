// Ramp test: climbs from 0 to 50 concurrent users and back down, looking for
// the point where latency or error rate starts to degrade. Read the p95
// figure this reports next to the honest performance-audit note that
// bcryptjs (chosen over native bcrypt for cPanel shared-hosting
// compatibility) makes login meaningfully slower than a compiled hash - so
// a rising login p95 under load is expected sooner than for other routes.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login, authHeaders } from './common.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const cookie = login();

  group('typical registrar session', () => {
    const cases = http.get(`${BASE_URL}/api/cases`, authHeaders(cookie));
    check(cases, { 'cases list ok': (r) => r.status === 200 });
    sleep(1);

    const arbitrators = http.get(`${BASE_URL}/api/arbitrators`, authHeaders(cookie));
    check(arbitrators, { 'arbitrators list ok': (r) => r.status === 200 });
    sleep(1);

    const documents = http.get(`${BASE_URL}/api/documents`, authHeaders(cookie));
    check(documents, { 'documents list ok': (r) => r.status === 200 });
    sleep(2);
  });
}
