import { defineConfig, devices } from '@playwright/test';

/**
 * Assumes the full stack is already running: MariaDB (XAMPP), the API
 * server (`npm run dev` in server/, port 3001), and this client
 * (`npm run dev` here, port 5173) against the dev database. Not wired to
 * webServer/globalSetup because bringing up MariaDB isn't something
 * Playwright can own - see README-e2e.md for the one-time setup.
 *
 * The `setup` project logs in once and every other test reuses that session
 * via storageState, rather than each test logging in fresh - the server
 * rate-limits login to 10 attempts / 15 min, which a full suite of
 * independent logins would burn through after a couple of runs.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one dev database and demo admin account
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
