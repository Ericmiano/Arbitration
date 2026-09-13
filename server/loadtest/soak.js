// Soak test: a moderate, sustained load held for 30 minutes, looking for
// degradation over time that a short test can't reveal - DB connection pool
// exhaustion, the MySQL-backed session store growing unbounded, memory
// creep in the Node process. Watch the server process itself (RSS, open
// connections) during this run, not just k6's own output.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, login, authHeaders } from './common.js';

export const options = {
  vus: 20,
  duration: '30m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const cookie = login();
  const cases = http.get(`${BASE_URL}/api/cases`, authHeaders(cookie));
  check(cases, { 'cases list ok': (r) => r.status === 200 });
  sleep(3);
}
