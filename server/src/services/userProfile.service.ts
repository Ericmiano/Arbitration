import { prisma } from '../lib/prisma';

/**
 * The display name for a user depends on role: arbitrators and parties
 * already have a full_name on their own table (set at onboarding/intake),
 * so we show that rather than users.full_name, which only really applies to
 * staff/admin/registrar accounts that have no other profile record.
 */
export async function resolveDisplayName(userId: number, role: string, fallbackEmail: string): Promise<string> {
  if (role === 'arbitrator') {
    const arbitrator = await prisma.arbitrators.findUnique({ where: { user_id: userId } });
    if (arbitrator) return arbitrator.full_name;
  }
  if (role === 'party') {
    const party = await prisma.parties.findFirst({ where: { user_id: userId } });
    if (party) return party.full_name;
  }
  const user = await prisma.users.findUnique({ where: { id: userId } });
  return user?.full_name ?? fallbackEmail;
}
