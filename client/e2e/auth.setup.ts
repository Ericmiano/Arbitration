import { test as setup } from '@playwright/test';

const authFile = 'e2e/.auth/admin.json';

/**
 * Logs in once and saves the session cookie for every other test to reuse
 * (via playwright.config.ts's storageState) - rather than every test calling
 * login() itself, which burns through the server's login rate limiter
 * (10 attempts / 15 min) after a couple of full suite runs.
 */
setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'admin@aak.local');
  await page.fill('#password', 'ChangeMe123!');
  await page.click('button:has-text("Log in")');
  await page.waitForSelector('text=Docket', { timeout: 10000 });
  await page.context().storageState({ path: authFile });
});
