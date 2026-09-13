import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReportsOverview, ReportsOverview } from '../api/reports';
import { downloadCsv } from '../lib/csv';

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  pending_agreement: 'Pending agreement',
  pending_assignment: 'Pending assignment',
  assigned: 'Assigned',
  ongoing: 'Ongoing',
  concluded: 'Concluded',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
};

export function Reports() {
  const [data, setData] = useState<ReportsOverview | null>(null);

  useEffect(() => {
    getReportsOverview().then(setData);
  }, []);

  if (!data) return <p>Loading...</p>;

  const maxMonthly = Math.max(1, ...data.caseVolumeByMonth.map((m) => m.count));
  const totalCases = data.casesByStatus.reduce((sum, s) => sum + s.count, 0);

  function exportWorkload() {
    if (!data) return;
    downloadCsv(
      `aak-arbitrator-workload-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Full name', value: (r: ReportsOverview['arbitratorWorkload'][number]) => r.fullName },
        { header: 'Status', value: (r: ReportsOverview['arbitratorWorkload'][number]) => r.status },
        { header: 'Active cases', value: (r: ReportsOverview['arbitratorWorkload'][number]) => r.activeCases },
        { header: 'Cases closed', value: (r: ReportsOverview['arbitratorWorkload'][number]) => r.casesClosedCount },
        { header: 'Score', value: (r: ReportsOverview['arbitratorWorkload'][number]) => r.score },
      ],
      data.arbitratorWorkload,
    );
  }

  return (
    <div className="flex flex-col gap-20">
      <div className="bg-sheet border border-ink px-24 pt-22 pb-18 flex flex-wrap gap-x-16 gap-y-10 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Reports</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-20">
        <div className="flex-[2_1_420px] bg-sheet border border-ink">
          <div className="px-20 pt-16 pb-4 font-mono text-9.5 tracking-[0.12em] text-muted">CASE VOLUME · LAST 12 MONTHS</div>
          <div className="px-20 pb-18 pt-8 flex items-end gap-6 h-[140px]">
            {data.caseVolumeByMonth.length === 0 ? (
              <p className="text-13 text-muted self-center">No cases filed in the last 12 months.</p>
            ) : (
              data.caseVolumeByMonth.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-6 h-full justify-end">
                  <span className="font-mono text-10.5">{m.count}</span>
                  <div
                    className="w-full bg-red"
                    style={{ height: `${Math.max(4, (m.count / maxMonthly) * 90)}px` }}
                  />
                  <span className="font-mono text-9.5 text-muted uppercase">{formatMonth(m.month)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-[1_1_260px] bg-sheet border border-ink">
          <div className="px-20 pt-16 pb-4 font-mono text-9.5 tracking-[0.12em] text-muted">AVG. RESOLUTION TIME</div>
          <div className="px-20 pb-20 pt-10">
            <div className="font-mono text-38 font-semibold leading-none">
              {data.avgResolutionDays ?? '—'}
              {data.avgResolutionDays !== null && <span className="text-15 font-normal text-muted"> days</span>}
            </div>
            <p className="mt-8 text-12.5 text-ink-2">
              Average time from filing to conclusion, across all concluded/closed cases on record.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-sheet border border-ink">
        <div className="px-20 pt-16 pb-4 font-mono text-9.5 tracking-[0.12em] text-muted">CASES BY STATUS</div>
        <div className="px-20 pb-16 pt-8">
          {data.casesByStatus.map((s) => (
            <div key={s.status} className="flex items-center gap-12 py-6">
              <span className="flex-[0_0_150px] text-13">{STATUS_LABELS[s.status] ?? s.status}</span>
              <div className="flex-1 h-8 bg-band">
                <div className="h-full bg-ink" style={{ width: `${totalCases ? (s.count / totalCases) * 100 : 0}%` }} />
              </div>
              <span className="flex-[0_0_36px] text-right font-mono text-11.5">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-sheet border border-ink">
        <div className="px-20 pt-16 pb-10 flex flex-wrap gap-x-12 gap-y-6 items-baseline">
          <span className="font-mono text-9.5 tracking-[0.12em] text-muted">OVERDUE ARBITRATIONS</span>
          <span className="font-mono text-10.5 text-red">{data.overdue.length}</span>
        </div>
        {data.overdue.length === 0 ? (
          <p className="px-20 pb-16 text-13 text-muted">Nothing currently overdue.</p>
        ) : (
          data.overdue.map((o) => (
            <Link
              key={o.assignmentId}
              to={`/cases/${o.caseId}`}
              className="no-underline text-ink flex flex-wrap gap-x-16 gap-y-4 items-baseline px-20 py-11 border-t border-hairline hover:bg-row-hover"
            >
              <span className="font-mono text-11.5 flex-[0_0_120px]">{o.caseNumber}</span>
              <span className="flex-[1_1_200px] min-w-0 text-13.5">{o.arbitratorName}</span>
              <span className="font-mono text-11 text-red flex-[0_0_140px]">{o.daysOverdue} days overdue</span>
              <span className="font-mono text-10.5 text-muted uppercase">{o.status}</span>
            </Link>
          ))
        )}
      </div>

      <div className="bg-sheet border border-ink">
        <div className="px-20 pt-16 pb-10 flex flex-wrap gap-x-16 gap-y-8 items-center">
          <span className="font-mono text-9.5 tracking-[0.12em] text-muted">ARBITRATOR WORKLOAD</span>
          <button
            type="button"
            onClick={exportWorkload}
            className="ml-auto min-h-[28px] px-12 border border-ink bg-transparent text-12 cursor-pointer hover:bg-band"
          >
            Export CSV
          </button>
        </div>
        {data.arbitratorWorkload.map((a) => (
          <Link
            key={a.id}
            to={`/arbitrators/${a.id}`}
            className="no-underline text-ink flex flex-wrap gap-x-16 gap-y-4 items-baseline px-20 py-11 border-t border-hairline hover:bg-row-hover"
          >
            <span className={`w-7 h-7 inline-block ${a.status === 'active' ? 'bg-green' : 'bg-muted-2'}`} />
            <span className="flex-[1_1_220px] min-w-0 text-13.5 font-medium">{a.fullName}</span>
            <span className="font-mono text-10.5 text-muted flex-[0_0_110px]">{a.activeCases} ACTIVE</span>
            <span className="font-mono text-10.5 text-muted flex-[0_0_110px]">{a.casesClosedCount} CLOSED</span>
            <span className="font-mono text-10.5 text-muted-2 flex-[0_0_90px]">SCORE {a.score}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
