import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { computeDueDate, deriveSlaTier } from '../src/services/sla.service';
import { truncateAll } from './helpers/db';

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('sla.service', () => {
  it('derives the simple tier for values under the simple/standard threshold', async () => {
    await expect(deriveSlaTier(1_000_000, 'KES')).resolves.toBe('simple');
  });

  it('derives the standard tier for values in the standard band', async () => {
    await expect(deriveSlaTier(15_000_000, 'KES')).resolves.toBe('standard');
  });

  it('derives the complex tier for values at or above the complex threshold', async () => {
    await expect(deriveSlaTier(50_000_000, 'KES')).resolves.toBe('complex');
    await expect(deriveSlaTier(500_000_000, 'KES')).resolves.toBe('complex');
  });

  it('is a hard cutoff at the exact boundary (5,000,000 is standard, not simple)', async () => {
    await expect(deriveSlaTier(5_000_000, 'KES')).resolves.toBe('standard');
  });

  it('rejects a currency with no configured tiers', async () => {
    await expect(deriveSlaTier(1_000_000, 'USD')).rejects.toThrow();
  });

  it('computes a due date by adding the tier\'s target_days to the given date', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const due = await computeDueDate('simple', 'KES', from);
    // simple tier = 60 days per schema.sql seed data
    expect(due.toISOString().slice(0, 10)).toBe('2026-03-02');
  });
});
