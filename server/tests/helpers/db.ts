import { prisma } from '../../src/lib/prisma';

// FK-safe order isn't actually required since we disable checks, but keeping
// it readable/intentional rather than alphabetical.
const TABLES = [
  'notifications',
  'audit_logs',
  'assignment_extensions',
  'assignments',
  'document_shares',
  'documents',
  'arbitrator_score_history',
  'arbitrator_conflicts',
  'arbitrator_specializations',
  'arbitrators',
  'case_parties',
  'cases',
  'contract_parties',
  'contracts',
  'parties',
  'organizations',
  'projects',
  'users',
  // sla_config intentionally excluded - its seed rows from schema.sql are
  // relied on by every test that touches SLA tiering.
];

export async function truncateAll() {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${table}`);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
}
