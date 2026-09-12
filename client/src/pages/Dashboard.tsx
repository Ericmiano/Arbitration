import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../api/cases';
import {
  arbitratorLabel,
  deadlineLine,
  disputeLine,
  GROUP_DEFS,
  groupKeyForCase,
  marginNote,
  partyLine,
  statusTone,
} from '../lib/caseDisplay';
import { useAuth } from '../context/AuthContext';
import { Case } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[] | null>(null);

  useEffect(() => {
    listCases().then(setCases);
  }, []);

  if (!cases) return <p>Loading...</p>;

  const overdueCount = cases.filter((c) => groupKeyForCase(c) === 'overdue').length;
  const appointCount = cases.filter((c) => groupKeyForCase(c) === 'appoint').length;
  const activeCount = cases.filter((c) => !['closed', 'concluded', 'withdrawn'].includes(c.status)).length;

  // Docket hides concluded/closed matters - that's what "All cases" is for.
  const visible = cases.filter((c) => groupKeyForCase(c) !== 'closed');
  const numbered = visible.map((c, i) => ({ c, no: String(i + 1).padStart(2, '0') }));

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 flex flex-wrap gap-x-26 gap-y-18 items-end border-b border-ink">
        <div className="flex-1 min-w-[300px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em] leading-[1.1]">Docket</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
            {today} · {user?.fullName} · {roleLabel(user?.role)}
          </div>
        </div>
        <div className="flex flex-wrap gap-22">
          <Tally value={String(overdueCount)} label="OVERDUE" toneClass="text-red" />
          <Tally value={String(appointCount)} label="TO APPOINT" toneClass="text-amber" />
          <Tally value={String(activeCount)} label="ACTIVE" toneClass="text-ink" />
        </div>
      </div>

      {GROUP_DEFS.filter((g) => g.key !== 'closed').map((group) => {
        const rows = numbered.filter(({ c }) => groupKeyForCase(c) === group.key);
        if (rows.length === 0) return null;

        return (
          <div key={group.key}>
            <div className="flex flex-wrap gap-x-12 gap-y-6 items-baseline px-24 py-9 bg-band border-b border-rule">
              <span className={`w-7 h-7 inline-block ${group.tone.replace('text-', 'bg-')}`} />
              <span className={`font-mono text-10.5 font-semibold tracking-[0.13em] ${group.tone}`}>
                {group.label}
              </span>
              <span className="font-mono text-10.5 text-muted">{String(rows.length).padStart(2, '0')}</span>
              <span className="text-12 text-ink-2">{group.note}</span>
            </div>

            {group.dense
              ? rows.map(({ c }) => (
                  <Link
                    key={c.id}
                    to={`/cases/${c.id}`}
                    className="no-underline text-ink flex flex-wrap gap-x-16 gap-y-4 items-baseline cursor-pointer px-24 py-10 border-b border-hairline hover:bg-row-hover hover:text-ink"
                  >
                    <span className="font-mono text-11.5 tracking-[0.04em] flex-[0_0_106px]">{c.case_number}</span>
                    <span className="flex-[2_1_220px] min-w-0 text-13.5 font-medium">
                      {c.projects?.name ?? c.category}
                    </span>
                    <span className={`flex-[1_1_176px] min-w-0 font-mono text-10.5 tracking-[0.04em] ${statusTone(group.key)}`}>
                      {deadlineLine(c, group.key)}
                    </span>
                  </Link>
                ))
              : rows.map(({ c, no }) => {
                  const { claimant, respondent } = partyLine(c);
                  return (
                    <Link
                      key={c.id}
                      to={`/cases/${c.id}`}
                      className="no-underline text-ink flex flex-wrap cursor-pointer border-b border-hairline hover:bg-row-hover hover:text-ink"
                    >
                      <div className="flex-[0_0_24px] py-15 pl-24 font-mono text-10 text-muted-3">{no}</div>
                      <div className="flex-[3_1_330px] min-w-0 py-14 pr-20 pl-12 flex flex-col gap-5">
                        <div className="flex flex-wrap gap-x-12 gap-y-4 items-baseline">
                          <span className="font-mono text-12 tracking-[0.04em]">{c.case_number}</span>
                          <span className="text-15 font-semibold tracking-[-0.01em]">
                            {c.projects?.name ?? c.category}
                          </span>
                        </div>
                        <div className="text-13 text-ink-2">
                          {claimant} <span className="text-muted-2">v.</span> {respondent}
                        </div>
                        <div className="font-mono text-10.5 tracking-[0.05em] text-muted">{disputeLine(c)}</div>
                      </div>
                      <div className="flex-[1_1_232px] min-w-0 py-14 pr-24 pl-18 border-l border-hairline flex flex-col gap-5">
                        <span className={`font-mono text-11 tracking-[0.04em] ${statusTone(group.key)}`}>
                          {deadlineLine(c, group.key)}
                        </span>
                        <span className="text-12.5 text-ink-2">{marginNote(c, group.key)}</span>
                        <span className="font-mono text-10 tracking-[0.08em] text-muted-2">{arbitratorLabel(c)}</span>
                      </div>
                    </Link>
                  );
                })}
          </div>
        );
      })}

      <div className="px-24 py-12 flex flex-wrap gap-x-16 gap-y-10 items-center text-12.5 text-ink-2">
        <span className="font-mono text-10.5 tracking-[0.08em]">
          {overdueCount + appointCount} MATTER{overdueCount + appointCount === 1 ? '' : 'S'} NEED ACTION TODAY ·
          FULL REGISTER UNDER CASES
        </span>
        <span className="ml-auto flex gap-14">
          <button type="button" disabled className="bg-transparent border-0 py-2 text-12.5 text-muted-3 cursor-not-allowed" aria-disabled="true">
            Previous
          </button>
          <button
            type="button"
            className="bg-transparent border-0 py-2 text-12.5 border-b border-ink cursor-pointer hover:text-red hover:border-red"
          >
            Next
          </button>
        </span>
      </div>
    </div>
  );
}

function Tally({ value, label, toneClass }: { value: string; label: string; toneClass: string }) {
  return (
    <div className="flex flex-col gap-4">
      <span className={`font-mono text-19 font-medium leading-none ${toneClass}`}>{value}</span>
      <span className="font-mono text-9.5 tracking-[0.1em] text-muted">{label}</span>
    </div>
  );
}

function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return 'AAK ADMINISTRATOR';
    case 'registrar':
      return 'AAK REGISTRAR';
    case 'staff':
      return 'AAK STAFF';
    default:
      return '';
  }
}
