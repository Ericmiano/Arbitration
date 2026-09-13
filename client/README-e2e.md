# End-to-end tests

`e2e/golden-path.spec.ts` drives the app through a browser (Playwright) against
the real dev stack - not mocks. It covers the workflow this system exists for:
party/project/contract intake, case creation, arbitrator onboarding and
conflict-of-interest exclusion, assignment, extension approval, document
upload, and outcome recording.

## One-time setup

```
npx playwright install chromium
```

## Running

Three things need to be running first, in order:

1. **MariaDB** (XAMPP): `C:\xampp\mysql\bin\mysqld.exe --defaults-file="C:\xampp\mysql\bin\my.ini"`
2. **API server**, from `server/`: `npm run dev` (needs `server/.env` set up and
   `aak_arbitration` seeded - see the root README/server setup notes; needs an
   admin account at `admin@aak.local` / `ChangeMe123!`, e.g. via `npm run db:seed`)
3. **This client**, from `client/`: `npm run dev`

Then, from `client/`:

```
npm run test:e2e
```

Every test uses a per-run unique suffix (timestamp) for names/emails, so the
suite can be re-run repeatedly against the same dev database without needing
a reset in between - it accumulates a few extra demo records each run rather
than colliding with existing ones.

## What's covered vs. not

Covered: the full case lifecycle through the UI, including the
conflict-of-interest exclusion check.

Not covered here (see `server/tests/` for API-level coverage instead):
account lockout, SLA tier derivation edge cases, the overdue/escalation cron
job, and score-calculation math - these don't have meaningful UI surface of
their own or are more precisely tested at the API layer.
