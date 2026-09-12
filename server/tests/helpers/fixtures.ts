import bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma';

export async function createUser(role: 'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party', overrides: {
  email?: string;
  password?: string;
} = {}) {
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor - tests don't need production security
  const user = await prisma.users.create({
    data: {
      email: overrides.email ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      password_hash: passwordHash,
      role,
    },
  });
  return { user, password };
}

export async function createParty(fullName: string) {
  return prisma.parties.create({ data: { type: 'individual', full_name: fullName } });
}

export async function createArbitrator(fullName: string) {
  const { user } = await createUser('arbitrator');
  return prisma.arbitrators.create({
    data: { user_id: user.id, full_name: fullName, joined_at: new Date() },
  });
}

export async function createCase(input: {
  createdBy: bigint;
  claimantId: bigint;
  respondentId: bigint;
  disputeValue: number;
  currency?: string;
  basis?: 'contractual_clause' | 'mutual_agreement';
}) {
  const currency = input.currency ?? 'KES';
  const config = await prisma.sla_config.findMany({ where: { currency } });
  const tier = config.find((c) => {
    const min = Number(c.min_value);
    const max = c.max_value === null ? null : Number(c.max_value);
    return input.disputeValue >= min && (max === null || input.disputeValue < max);
  });
  if (!tier) throw new Error(`No sla_config tier for ${input.disputeValue} ${currency}`);

  return prisma.cases.create({
    data: {
      case_number: `TEST/${Date.now()}/${Math.random().toString(36).slice(2, 6)}`,
      dispute_value: input.disputeValue,
      currency,
      category: 'test',
      description: 'Test case',
      basis: input.basis ?? 'contractual_clause',
      sla_tier: tier.tier,
      status: 'pending_assignment',
      created_by: input.createdBy,
      case_parties: {
        create: [
          { party_id: input.claimantId, role: 'claimant' },
          { party_id: input.respondentId, role: 'respondent' },
        ],
      },
    },
  });
}
