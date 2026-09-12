import { cases_sla_tier as SlaTier, sla_config } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Picks the SLA tier whose [min_value, max_value) band contains disputeValue,
 * for the given currency. Thresholds live in sla_config (DB-driven) rather
 * than hardcoded, per the agreed design - adjustable without a code change.
 * Tier depends only on value/currency, so it's fixed once at case intake.
 */
export async function deriveSlaTier(disputeValue: number, currency: string): Promise<SlaTier> {
  const config = await findConfig(disputeValue, currency);
  return config.tier;
}

/**
 * Adds the tier's target_days to `from` (the assignment date) - due_date is
 * only meaningful once a case has actually been assigned to an arbitrator.
 */
export async function computeDueDate(
  tier: SlaTier,
  currency: string,
  from: Date = new Date(),
): Promise<Date> {
  const config = await prisma.sla_config.findUnique({
    where: { tier_currency: { tier, currency } },
  });
  if (!config) {
    throw new Error(`No sla_config row for tier ${tier} / currency ${currency}`);
  }
  const dueDate = new Date(from);
  dueDate.setDate(dueDate.getDate() + config.target_days);
  return dueDate;
}

async function findConfig(disputeValue: number, currency: string): Promise<sla_config> {
  const configs = await prisma.sla_config.findMany({ where: { currency } });
  if (configs.length === 0) {
    throw new Error(`No sla_config rows found for currency ${currency}`);
  }

  const match = configs.find((config) => {
    const min = Number(config.min_value);
    const max = config.max_value === null ? null : Number(config.max_value);
    return disputeValue >= min && (max === null || disputeValue < max);
  });

  if (!match) {
    throw new Error(`No sla_config tier covers dispute value ${disputeValue} ${currency}`);
  }
  return match;
}
