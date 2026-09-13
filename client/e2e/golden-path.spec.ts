import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * End-to-end regression test for the core arbitration workflow, run against
 * the real dev stack (MariaDB + API server + this client - see
 * README-e2e.md). Every name/email is suffixed with a per-run token so the
 * test can be re-run repeatedly without needing to reset the database first.
 * Login itself is covered separately in login.spec.ts - these tests reuse
 * the shared admin session from auth.setup.ts (see playwright.config.ts).
 */

const RUN_ID = Date.now().toString(36);

test.describe.configure({ mode: 'serial' });

let caseNumber: string;

test('create claimant and respondent parties', async ({ page }) => {
  await page.goto('/parties');

  for (const name of [`Claimant ${RUN_ID}`, `Respondent ${RUN_ID}`]) {
    await page.click('button:has-text("New party")');
    await page.fill('input[name="fullName"]', name);
    await page.click('form button:has-text("Create")');
    await expect(page.locator(`text=${name}`)).toBeVisible();
  }
});

test('create a project with an arbitration-clause contract', async ({ page }) => {
  await page.goto('/projects');

  await page.click('button:has-text("New project")');
  await page.fill('input[name="name"]', `Project ${RUN_ID}`);
  await page.fill('input[name="sector"]', 'construction');
  await page.fill('input[name="value"]', '80000000');
  await page.click('form button:has-text("Create")');
  await expect(page.locator(`text=Project ${RUN_ID}`)).toBeVisible();

  // Scoped to this project's own block - the page lists every project, each
  // with its own "Add contract" button, so an unscoped click would hit
  // whichever project happens to sort first (a real bug this caught: it was
  // attaching the contract to an unrelated pre-existing project).
  const projectBlock = page.locator('div.border-b.border-hairline.px-24.py-18', {
    hasText: `Project ${RUN_ID}`,
  });
  await projectBlock.locator('button:has-text("Add contract")').click();
  await page.fill('input[name="referenceNumber"]', `CT-${RUN_ID}`);
  await page.check('input[name="hasArbitrationClause"]');
  await page.selectOption('select[name="employerPartyId"]', { label: `Claimant ${RUN_ID}` });
  await page.selectOption('select[name="contractorPartyId"]', { label: `Respondent ${RUN_ID}` });
  await page.click('button:has-text("Create contract")');
  await expect(projectBlock.locator(`text=CT-${RUN_ID}`)).toBeVisible();
});

test('start a new arbitration case', async ({ page }) => {
  await page.goto('/cases/new');

  await page.selectOption('select[name="basis"]', 'contractual_clause');
  await page.selectOption('select[name="projectId"]', { label: `Project ${RUN_ID}` });
  await page.waitForTimeout(200); // contract options populate from the selected project
  await page.selectOption('select[name="contractId"]', { label: `CT-${RUN_ID} (has clause)` });
  await page.selectOption('select[name="claimantId"]', { label: `Claimant ${RUN_ID}` });
  await page.selectOption('select[name="respondentId"]', { label: `Respondent ${RUN_ID}` });
  await page.fill('input[name="disputeValue"]', '15000000');
  await page.fill('input[name="category"]', 'payment');
  await page.fill('textarea[name="description"]', `E2E test dispute ${RUN_ID}`);
  await page.click('button:has-text("Submit for intake")');

  await page.waitForURL(/\/cases\/\d+/, { timeout: 10000 });
  // The case number lives in a "<ref> · FILED <date>" line above the parties
  // h1, not in the h1 itself - match on the ref pattern directly rather than
  // fighting Tailwind's arbitrary-value class names in a CSS locator.
  const refLine = await page.getByText(/AAK\/ARB\//).first().innerText();
  caseNumber = refLine.split(' · ')[0];
  expect(caseNumber).toMatch(/^AAK\/ARB\//);
});

test('onboard an arbitrator', async ({ page }) => {
  await page.goto('/arbitrators');

  await page.click('button:has-text("Onboard arbitrator")');
  await page.fill('input[name="email"]', `arbitrator-${RUN_ID}@example.com`);
  await page.fill('input[name="fullName"]', `Arbitrator ${RUN_ID}`);
  await page.fill('input[name="specializations"]', 'construction');
  await page.click('form button:has-text("Create")');
  await expect(page.locator(`text=Arbitrator ${RUN_ID}`)).toBeVisible({ timeout: 10000 });
});

test('assign the arbitrator and record an extension request', async ({ page }) => {
  await page.goto('/cases');
  await page.click(`text=${caseNumber}`);

  await page.click('button:has-text("Assign arbitrator")');
  await expect(page.locator('text=ELIGIBLE ARBITRATORS')).toBeVisible();

  const row = page.locator('div', { hasText: `Arbitrator ${RUN_ID}` }).last();
  await row.locator('button:has-text("Assign")').click();
  await expect(page.locator(`text=Arbitrator ${RUN_ID}`).first()).toBeVisible({ timeout: 10000 });

  // Request + approve an extension, and confirm it clears any overdue flag.
  await page.fill('input[name="reason"]', 'Awaiting expert report');
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.fill('input[name="requestedDueDate"]', future);
  await page.click('button:has-text("Request")');
  await expect(page.locator('text=EXTENSION REQUESTS')).toBeVisible({ timeout: 10000 });

  await page.click('button:has-text("Approve")');
  await expect(page.locator('text=approved').first()).toBeVisible({ timeout: 10000 });
});

test('upload a document and confirm it is downloadable', async ({ page }) => {
  await page.goto('/cases');
  await page.click(`text=${caseNumber}`);
  await page.click('button:has-text("Upload document")');

  const tmpFile = path.join(os.tmpdir(), `e2e-${RUN_ID}.pdf`);
  fs.writeFileSync(tmpFile, '%PDF-1.4 e2e test file');
  await page.setInputFiles('input[name="file"]', tmpFile);
  await page.click('form button:has-text("Upload")');

  await expect(page.locator(`text=e2e-${RUN_ID}.pdf`)).toBeVisible({ timeout: 10000 });
  const downloadLink = page.locator('a:has-text("Download")').first();
  await expect(downloadLink).toHaveAttribute('href', /\/api\/documents\//);

  fs.unlinkSync(tmpFile);
});

test('record an outcome and confirm the case concludes', async ({ page }) => {
  await page.goto('/cases');
  await page.click(`text=${caseNumber}`);
  await page.click('button:has-text("Record outcome")');

  await page.selectOption('select[name="outcome"]', 'award_issued');
  await page.fill('textarea[name="outcomeDetail"]', 'Award issued in favour of the claimant.');
  await page.click('button:has-text("Mark completed")');

  // The status line shows the specific outcome (e.g. "AWARD ISSUED"), not
  // the generic word "concluded" - and the arbitrator's name must still be
  // visible on a closed case (regression check: their assignment used to
  // disappear entirely once completed, since the summary query only
  // included active-status assignments).
  await expect(page.locator('text=AWARD ISSUED')).toBeVisible({ timeout: 10000 });
  await expect(page.locator(`text=Arbitrator ${RUN_ID}`).first()).toBeVisible();
  await expect(page.locator('button:has-text("Record outcome")')).toHaveCount(0);
});

test("declaring a conflict excludes the arbitrator from a new case's eligible pool", async ({ page }) => {
  // Declare a conflict for the arbitrator we onboarded against the claimant.
  await page.goto('/arbitrators');
  await page.click(`text=Arbitrator ${RUN_ID}`);
  await page.click('button:has-text("Declare conflict")');
  await page.getByRole('radio', { name: 'Party' }).check();
  await page.selectOption('select[name="targetId"]', { label: `Claimant ${RUN_ID}` });
  await page.fill('input[name="reason"]', 'Previously represented this party');
  await page.click('button:has-text("Declare")');
  await expect(page.locator('text=Previously represented this party')).toBeVisible({ timeout: 10000 });

  // Start a second case against the same contract/claimant (contractual_clause
  // basis goes straight to pending_assignment, so the eligible pool is
  // reachable immediately) and confirm the conflicted arbitrator is excluded.
  await page.goto('/cases/new');
  await page.selectOption('select[name="basis"]', 'contractual_clause');
  await page.selectOption('select[name="projectId"]', { label: `Project ${RUN_ID}` });
  await page.waitForTimeout(200);
  await page.selectOption('select[name="contractId"]', { label: `CT-${RUN_ID} (has clause)` });
  await page.selectOption('select[name="claimantId"]', { label: `Claimant ${RUN_ID}` });
  await page.selectOption('select[name="respondentId"]', { label: `Respondent ${RUN_ID}` });
  await page.fill('input[name="disputeValue"]', '2000000');
  await page.fill('input[name="category"]', 'delay');
  await page.fill('textarea[name="description"]', `Second E2E dispute ${RUN_ID}`);
  await page.click('button:has-text("Submit for intake")');
  await page.waitForURL(/\/cases\/\d+/, { timeout: 10000 });

  await page.click('button:has-text("Assign arbitrator")');
  await expect(page.locator('text=ELIGIBLE ARBITRATORS')).toBeVisible();
  await expect(page.locator(`text=Arbitrator ${RUN_ID}`)).toHaveCount(0);
});
