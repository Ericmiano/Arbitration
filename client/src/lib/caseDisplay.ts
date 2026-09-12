import { Case } from '../types';

export type CaseGroupKey = 'overdue' | 'appoint' | 'progress' | 'closed';

export interface GroupDef {
  key: CaseGroupKey;
  label: string;
  tone: string;
  note: string;
  dense: boolean;
}

export const GROUP_DEFS: GroupDef[] = [
  { key: 'overdue', label: 'OVERDUE', tone: 'text-red', note: 'Past the agreed date. Act today.', dense: false },
  {
    key: 'appoint',
    label: 'AWAITING APPOINTMENT',
    tone: 'text-amber',
    note: 'No arbitrator on record.',
    dense: false,
  },
  {
    key: 'progress',
    label: 'IN PROGRESS',
    tone: 'text-ink-2',
    note: 'Nothing required from AAK today.',
    dense: true,
  },
  { key: 'closed', label: 'CONCLUDED', tone: 'text-muted-2', note: 'Retained for the register.', dense: true },
];

export function activeAssignment(c: Case) {
  return c.assignments[0];
}

export function groupKeyForCase(c: Case): CaseGroupKey {
  const assignment = activeAssignment(c);
  if (assignment && (assignment.status === 'overdue' || assignment.status === 'escalated')) return 'overdue';
  if (['concluded', 'closed', 'withdrawn'].includes(c.status)) return 'closed';
  if (['pending_assignment', 'pending_agreement', 'intake'].includes(c.status)) return 'appoint';
  return 'progress';
}

export function statusTone(group: CaseGroupKey): string {
  return GROUP_DEFS.find((g) => g.key === group)!.tone;
}

export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function formatMonoDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .toUpperCase()
    .replace('.', '');
}

export function formatMoney(value: string | number, currency: string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return `${currency} ${num.toLocaleString('en-KE')}`;
}

/** The mono deadline/status line shown in the margin (full row) or as the "next date" (dense row). */
export function deadlineLine(c: Case, group: CaseGroupKey): string {
  const assignment = activeAssignment(c);
  const now = new Date();

  if (group === 'overdue' && assignment) {
    const days = daysBetween(new Date(assignment.due_date), now);
    return `DUE ${formatMonoDate(assignment.due_date)} · ${days} DAY${days === 1 ? '' : 'S'} OVERDUE`;
  }
  if (group === 'appoint') {
    return `FILED ${formatMonoDate(c.filed_at)}`;
  }
  if (group === 'closed') {
    const days = c.concluded_at ? daysBetween(new Date(c.filed_at), new Date(c.concluded_at)) : null;
    return `CLOSED ${c.concluded_at ? formatMonoDate(c.concluded_at) : '-'}${days !== null ? ` · ${days} DAYS` : ''}`;
  }
  // progress
  return assignment ? `DUE ${formatMonoDate(assignment.due_date)}` : 'IN PROGRESS';
}

/** The sans-serif reason note in the margin (full rows only). */
export function marginNote(c: Case, group: CaseGroupKey): string {
  const assignment = activeAssignment(c);
  if (group === 'overdue' && assignment) {
    const days = daysBetween(new Date(assignment.due_date), new Date());
    return `Past the agreed date by ${days} day${days === 1 ? '' : 's'}. No update recorded since assignment.`;
  }
  if (group === 'appoint') {
    return c.basis === 'mutual_agreement' && c.status === 'pending_agreement'
      ? 'Awaiting a signed submission agreement from both parties.'
      : 'Filed and ready - no arbitrator appointed yet.';
  }
  return '';
}

export function arbitratorLabel(c: Case): string {
  const assignment = activeAssignment(c);
  return assignment ? assignment.arbitrators.full_name.toUpperCase() : 'NOT APPOINTED';
}

export function disputeLine(c: Case): string {
  const location = c.projects?.location;
  return `DISPUTE ${formatMoney(c.dispute_value, c.currency)}${location ? ` · ${location.toUpperCase()}` : ''}`;
}

export function partyLine(c: Case): { claimant: string; respondent: string } {
  const claimant = c.case_parties.find((p) => p.role === 'claimant')?.parties.full_name ?? 'Unnamed claimant';
  const respondent = c.case_parties.find((p) => p.role === 'respondent')?.parties.full_name ?? 'Unnamed respondent';
  return { claimant, respondent };
}
