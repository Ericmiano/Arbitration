import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../api/cases';
import { downloadCsv } from '../lib/csv';
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
import { Case } from '../types';

const FILTERS = [
  { label: 'All', key: null },
  { label: 'Overdue', key: 'overdue' },
  { label: 'Awaiting appointment', key: 'appoint' },
  { label: 'In progress', key: 'progress' },
  { label: 'Concluded', key: 'closed' },
] as const;

export function Cases() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>(null);
  const [query, setQuery] = useState('');

  function reload(q?: string) {
    listCases(q).then(setCases);
  }

  useEffect(() => reload(), []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    reload(query || undefined);
  }

  function handleExport() {
    if (!cases) return;
    downloadCsv(
      `aak-cases-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Case number', value: (c: Case) => c.case_number },
        { header: 'Status', value: (c: Case) => c.status },
        { header: 'Category', value: (c: Case) => c.category },
        { header: 'Dispute value', value: (c: Case) => disputeLine(c) },
        { header: 'Claimant', value: (c: Case) => partyLine(c).claimant },
        { header: 'Respondent', value: (c: Case) => partyLine(c).respondent },
        { header: 'Filed at', value: (c: Case) => c.filed_at },
        { header: 'Due date', value: (c: Case) => c.due_date ?? '' },
        { header: 'Arbitrator', value: (c: Case) => arbitratorLabel(c) },
      ],
      cases,
    );
  }

  if (!cases) return <p>Loading...</p>;

  const numbered = cases.map((c, i) => ({ c, no: String(i + 1).padStart(2, '0') }));
  const filtered = filter ? numbered.filter(({ c }) => groupKeyForCase(c) === filter) : numbered;

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f.label,
      f.key === null ? cases.length : cases.filter((c) => groupKeyForCase(c) === f.key).length,
    ]),
  );

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 flex flex-wrap gap-x-26 gap-y-18 items-end border-b border-ink">
        <div className="flex-1 min-w-[300px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em] leading-[1.1]">All cases</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
            {cases.length} arbitration{cases.length === 1 ? '' : 's'} on the register
          </div>
        </div>
        <form onSubmit={handleSearch} className="flex gap-8 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search case #, party, description"
            className="w-[260px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
          />
          <button type="submit" className="min-h-[31px] px-12 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
            Search
          </button>
          <button type="button" onClick={handleExport} className="min-h-[31px] px-12 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
            Export CSV
          </button>
        </form>
      </div>

      <div className="flex flex-wrap border-b border-rule bg-band-alt">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-7 px-16 py-9 whitespace-nowrap text-12.5 border-0 cursor-pointer ${
                active ? 'bg-sheet font-semibold text-ink shadow-[inset_0_-2px_0_#A5121C]' : 'bg-transparent text-ink-2'
              }`}
            >
              {f.label} <span className="font-mono text-10.5 text-muted">{counts[f.label]}</span>
            </button>
          );
        })}
      </div>

      {GROUP_DEFS.map((group) => {
        const rows = filtered.filter(({ c }) => groupKeyForCase(c) === group.key);
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

      {filtered.length === 0 && <p className="px-24 py-20 text-13">No cases match this filter.</p>}

      <div className="px-24 py-12 flex flex-wrap gap-x-16 gap-y-10 items-center text-12.5 text-ink-2">
        <span className="font-mono text-10.5 tracking-[0.08em]">
          SHOWING {filtered.length} OF {cases.length}
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
