import { Case, Tribunal } from '../types';

export type CaseGroupKey = 'overdue' | 'appoint' | 'progress' | 'closed' | 'withdrawn';

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
  { key: 'closed', label: 'CONCLUDED', tone: 'text-green', note: 'Award issued or settled - retained for the register.', dense: true },
  { key: 'withdrawn', label: 'WITHDRAWN', tone: 'text-muted-2', note: 'No award or settlement - matter withdrawn.', dense: true },
];

export function activeAssignment(c: Case) {
  return c.assignments[0];
}

/** The tribunal currently forming/constituted for this case, if the tribunal model has been used on it. */
export function activeTribunal(c: Case): Tribunal | undefined {
  return c.active_tribunal?.[0];
}

export function activeTribunalMembers(c: Case) {
  const tribunal = activeTribunal(c);
  if (!tribunal) return [];
  return tribunal.members.filter((m) => ['nominated', 'appointed', 'accepted'].includes(m.status));
}

export function groupKeyForCase(c: Case): CaseGroupKey {
  const assignment = activeAssignment(c);
  if (assignment && (assignment.status === 'overdue' || assignment.status === 'escalated')) return 'overdue';
  // Withdrawn is procedurally distinct from an award or settlement - no
  // decision was ever reached - so it gets its own group rather than
  // being folded into "concluded".
  if (c.status === 'withdrawn') return 'withdrawn';
  if (['concluded', 'closed'].includes(c.status)) return 'closed';
  if (['pending_assignment', 'pending_agreement', 'intake'].includes(c.status)) return 'appoint';
  return 'progress';
}

/** True for either terminal group - used where "not still active" is the only distinction that matters (e.g. hiding both from an action-needed docket). */
export function isTerminalGroup(group: CaseGroupKey): boolean {
  return group === 'closed' || group === 'withdrawn';
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
    const outcomeLabel = c.outcome ? c.outcome.replace(/_/g, ' ').toUpperCase() : 'CONCLUDED';
    return `${outcomeLabel} ${c.concluded_at ? formatMonoDate(c.concluded_at) : '-'}${days !== null ? ` · ${days} DAYS` : ''}`;
  }
  if (group === 'withdrawn') {
    return `WITHDRAWN${c.concluded_at ? ` ${formatMonoDate(c.concluded_at)}` : ''}`;
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
  const tribunal = activeTribunal(c);
  if (tribunal) {
    const members = activeTribunalMembers(c);
    if (members.length === 0) return 'NOT APPOINTED';
    if (tribunal.tribunal_type === 'sole') return members[0].arbitrator.full_name.toUpperCase();
    return `PANEL (${members.length}/3)`;
  }

  // Cases created before the tribunal model (or where it hasn't been used
  // yet) have no active_tribunal row at all - fall back to the plain
  // assignment they already have.
  const assignment = activeAssignment(c);
  return assignment ? assignment.arbitrator.full_name.toUpperCase() : 'NOT APPOINTED';
}

export function disputeLine(c: Case): string {
  const location = c.project?.location;
  return `DISPUTE ${formatMoney(c.dispute_value, c.currency)}${location ? ` · ${location.toUpperCase()}` : ''}`;
}

export interface TimelineEvent {
  date: string;
  title: string;
  meta: string;
  tone: 'past' | 'overdue' | 'future';
}

/**
 * A best-effort procedural history derived from the fields we actually have
 * (filed, assigned, extensions aren't tracked in the Case payload, due date,
 * concluded). Not the fully itemised submission-by-submission log the design
 * mockup shows with invented case-specific events - we only surface what's
 * real.
 */
export function buildTimeline(c: Case): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { date: c.filed_at, title: 'Case filed', meta: `Case ${c.case_number} entered on the register`, tone: 'past' },
  ];

  const assignment = activeAssignment(c);
  if (assignment) {
    events.push({
      date: assignment.due_date, // no separate "assigned_at" surfaced on AssignmentSummary yet
      title: `Arbitrator appointed`,
      meta: `${assignment.arbitrator.full_name}`,
      tone: 'past',
    });

    const group = groupKeyForCase(c);
    if (group === 'overdue') {
      events.push({
        date: assignment.due_date,
        title: 'Became overdue',
        meta: deadlineLine(c, group),
        tone: 'overdue',
      });
    } else if (group === 'progress') {
      events.push({
        date: assignment.due_date,
        title: 'Next date',
        meta: `Due ${formatMonoDate(assignment.due_date)}`,
        tone: 'future',
      });
    }
  }

  if (c.concluded_at) {
    events.push({
      date: c.concluded_at,
      title: 'Case concluded',
      meta: c.outcome ? c.outcome.replace(/_/g, ' ') : 'Outcome recorded',
      tone: 'past',
    });
  }

  return events;
}

export function partyLine(c: Case): { claimant: string; respondent: string } {
  const claimant = c.parties.find((p) => p.pivot.role === 'claimant')?.full_name ?? 'Unnamed claimant';
  const respondent = c.parties.find((p) => p.pivot.role === 'respondent')?.full_name ?? 'Unnamed respondent';
  return { claimant, respondent };
}
