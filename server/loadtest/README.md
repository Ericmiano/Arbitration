# Load testing (k6)

k6 is free and open-source: https://k6.io/open-source/ (Apache 2.0). Install it with
whatever your OS actually supports interactively - `winget install k6.k6`, `brew install k6`,
or download a binary release directly from GitHub if neither works.

**Never point these at production or at anyone's laptop dev server expecting production-shaped
results.** They're meant to run against a disposable staging deployment - see the main audit
report's infrastructure notes for a free staging option (Oracle Cloud's Always Free tier is
generous enough to host a full staging copy of this app).

Each script needs a **seeded staging account** it's allowed to hammer - never a real user's
credentials. Set it via environment variables, not by editing the script:

```bash
export K6_BASE_URL="https://staging.yourdomain.org"
export K6_EMAIL="loadtest@yourdomain.org"
export K6_PASSWORD="whatever-you-seeded-it-with"
```

## Scripts

| Script | Shape | What it answers |
|---|---|---|
| `smoke.js` | 1-2 VUs, 30s | Does the deployed build even work end to end? Run this first, always. |
| `ramp.js` | 0 -> 50 VUs over 5 min, hold, ramp down | Where do p95 latency and error rate start degrading as concurrent users climb? |
| `spike.js` | Sudden jump to 100 VUs for 1 min | Does the app recover cleanly from a burst (e.g. a filing deadline), or does it fall over and stay down? |
| `soak.js` | 20 VUs sustained for 30 min | Does anything leak or degrade over time - DB connections, memory, session store growth - that a short test wouldn't show? |

## Running

```bash
k6 run smoke.js
k6 run ramp.js
k6 run spike.js
k6 run soak.js   # takes 30+ minutes by design - this is the point
```

## Reading results

k6 prints p50/p90/p95/p99 and error rate at the end of every run. The thresholds baked into
each script (`http_req_failed`, `http_req_duration`) will fail the run (non-zero exit code) if
the API breaches them - useful for wiring into a CI job once a staging target actually exists,
but don't wire that up before it does; a load test with nothing real behind it just measures
noise.
