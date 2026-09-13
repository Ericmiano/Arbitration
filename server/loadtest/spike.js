// Spike test: simulates a sudden burst - e.g. every party checking a case
// status right before a filing deadline - rather than gradual growth. The
// question isn't just "does it survive the spike" but "does it recover
// cleanly once the spike ends," which is why the stages ramp back to 0
// instead of just stopping.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, login, authHeaders } from './common.js';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const cookie = login();
  const cases = http.get(`${BASE_URL}/api/cases`, authHeaders(cookie));
  check(cases, { 'cases list ok during spike': (r) => r.status === 200 });
  sleep(0.5);
}
