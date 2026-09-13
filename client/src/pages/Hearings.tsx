import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listHearings, updateHearing } from '../api/hearings';
import { useAuth } from '../context/AuthContext';
import { Hearing } from '../types';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusTone(status: Hearing['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green';
    case 'cancelled':
      return 'text-muted-2';
    case 'postponed':
      return 'text-amber';
    default:
      return 'text-ink';
  }
}

export function Hearings() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';
  const [hearings, setHearings] = useState<Hearing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listHearings().then(setHearings);
  }

  useEffect(reload, []);

  async function handleStatusChange(hearingId: string, status: Hearing['status']) {
    setError(null);
    try {
      await updateHearing(hearingId, { status });
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Could not update the hearing.');
    }
  }

  if (!hearings) return <p>Loading...</p>;

  const now = Date.now();
  const upcoming = hearings
    .filter((h) => h.status === 'scheduled' && new Date(h.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = hearings
    .filter((h) => !upcoming.includes(h))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Hearings</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
          {upcoming.length} upcoming · {past.length} past or cancelled
        </div>
      </div>

      {error && <p className="px-24 pt-14 text-13 text-red">{error}</p>}

      <div className="px-24 pt-18 pb-6 font-mono text-9.5 tracking-[0.12em] text-muted">UPCOMING</div>
      {upcoming.length === 0 ? (
        <p className="px-24 pb-18 text-13 text-muted">No hearings scheduled.</p>
      ) : (
        upcoming.map((h) => (
          <HearingRow key={h.id} hearing={h} isStaff={isStaff} onStatusChange={handleStatusChange} />
        ))
      )}

      {past.length > 0 && (
        <>
          <div className="px-24 pt-20 pb-6 border-t border-rule font-mono text-9.5 tracking-[0.12em] text-muted">
            PAST &amp; CANCELLED
          </div>
          {past.map((h) => (
            <HearingRow key={h.id} hearing={h} isStaff={isStaff} onStatusChange={handleStatusChange} />
          ))}
        </>
      )}

      <div className="px-24 py-18 text-13 text-ink-2">
        New hearings are scheduled from within a case - open the case, go to its Hearings tab.
      </div>
    </div>
  );
}

function HearingRow({
  hearing,
  isStaff,
  onStatusChange,
}: {
  hearing: Hearing;
  isStaff: boolean;
  onStatusChange: (hearingId: string, status: Hearing['status']) => void;
}) {
  return (
    <div className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-6 items-baseline">
      <span className="flex-[0_0_170px] font-mono text-11.5 tracking-[0.04em]">{formatWhen(hearing.scheduled_at)}</span>
      <Link to={`/cases/${hearing.case_id}`} className="flex-[1_1_180px] min-w-0 text-13.5 font-medium">
        {hearing.cases.case_number}
      </Link>
      <span className="flex-[0_0_120px] font-mono text-10 tracking-[0.09em] text-muted uppercase">
        {hearing.mode.replace('_', ' ')}
      </span>
      <span className={`flex-[0_0_100px] font-mono text-10.5 tracking-[0.06em] uppercase ${statusTone(hearing.status)}`}>
        {hearing.status}
      </span>
      <span className="basis-full text-12 text-muted">{hearing.venue_or_link}</span>
      {isStaff && hearing.status === 'scheduled' && (
        <span className="flex gap-8">
          <button
            type="button"
            onClick={() => onStatusChange(hearing.id, 'completed')}
            className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
          >
            Mark completed
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(hearing.id, 'cancelled')}
            className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
