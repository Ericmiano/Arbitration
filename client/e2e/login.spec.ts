import { expect, test } from '@playwright/test';

// Deliberately unauthenticated - this is the one file that should actually
// exercise the login form itself, so it opts out of the shared admin session.
test.use({ storageState: { cookies: [], origins: [] } });

test('logs in with correct credentials and reaches the docket', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'admin@aak.local');
  await page.fill('#password', 'ChangeMe123!');
  await page.click('button:has-text("Log in")');
  await expect(page.locator('h1')).toHaveText('Docket', { timeout: 10000 });
});

test('shows an error on a wrong password without navigating away', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'admin@aak.local');
  await page.fill('#password', 'definitely-wrong');
  await page.click('button:has-text("Log in")');
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/login/);
});
