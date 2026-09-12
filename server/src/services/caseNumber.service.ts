import { prisma } from '../lib/prisma';

/**
 * Generates the next case number for the current year, e.g. AAK/ARB/2026/0001.
 *
 * Not fully race-safe under concurrent intake (two staff submitting in the
 * same instant could both compute the same sequence number) - acceptable for
 * AAK's expected staff headcount, but if that ever becomes a real problem,
 * replace with a dedicated auto-increment counter table guarded by a
 * transaction-level lock.
 */
export async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.cases.count({
    where: { case_number: { startsWith: `AAK/ARB/${year}/` } },
  });
  const sequence = String(count + 1).padStart(4, '0');
  return `AAK/ARB/${year}/${sequence}`;
}
