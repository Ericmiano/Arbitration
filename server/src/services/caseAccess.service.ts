import { prisma } from '../lib/prisma';

export interface SessionUser {
  id: number;
  role: 'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party';
}

const STAFF_ROLES: SessionUser['role'][] = ['admin', 'registrar', 'staff'];

/** Whether the session user has any visibility into this case at all. */
export async function canAccessCase(caseId: number, sessionUser: SessionUser): Promise<boolean> {
  if (STAFF_ROLES.includes(sessionUser.role)) return true;

  if (sessionUser.role === 'arbitrator') {
    const arbitrator = await prisma.arbitrators.findUnique({ where: { user_id: sessionUser.id } });
    if (!arbitrator) return false;
    const assignment = await prisma.assignments.findFirst({
      where: { case_id: caseId, arbitrator_id: arbitrator.id },
      select: { id: true },
    });
    return assignment !== null;
  }

  // role === 'party'
  const membership = await prisma.case_parties.findFirst({
    where: { case_id: caseId, parties: { user_id: sessionUser.id } },
    select: { case_id: true },
  });
  return membership !== null;
}
