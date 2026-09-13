import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { declareConflict, getArbitrator } from '../api/arbitrators';
import { listOrganizations } from '../api/organizations';
import { listParties } from '../api/parties';
import { useAuth } from '../context/AuthContext';
import { useBreadcrumb } from '../context/BreadcrumbContext';
import { ArbitratorProfile, Organization, Party } from '../types';

export function ArbitratorDetail() {
  const { arbitratorId } = useParams();
  const { user } = useAuth();
  const canDeclareConflict = user?.role === 'admin' || user?.role === 'registrar';
  const [arbitrator, setArbitrator] = useState<ArbitratorProfile | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showConflictForm, setShowConflictForm] = useState(false);
  const [conflictTarget, setConflictTarget] = useState<'party' | 'organization'>('party');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (arbitratorId) getArbitrator(arbitratorId).then(setArbitrator);
  }

  useEffect(reload, [arbitratorId]);

  useEffect(() => {
    if (canDeclareConflict) {
      listParties().then(setParties);
      listOrganizations().then(setOrganizations);
    }
  }, [canDeclareConflict]);

  useBreadcrumb(arbitrator ? `ARBITRATORS / ${arbitrator.full_name.toUpperCase()}` : undefined);

  async function handleDeclareConflict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!arbitratorId) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await declareConflict(arbitratorId, {
        partyId: conflictTarget === 'party' ? Number(form.get('targetId')) : undefined,
        organizationId: conflictTarget === 'organization' ? Number(form.get('targetId')) : undefined,
        reason: String(form.get('reason')),
      });
      setShowConflictForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to declare conflict');
    }
  }

  if (!arbitrator) return <p>Loading...</p>;

  const activeConflicts = (arbitrator.arbitrator_conflicts ?? []).filter(
    (c) => !c.expires_at || new Date(c.expires_at) > new Date(),
  );

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <div className="font-mono text-11.5 tracking-[0.12em] text-muted">
          {arbitrator.aak_membership_no ? `AAK ${arbitrator.aak_membership_no}` : 'AAK ARBITRATOR'}
        </div>
        <h1 className="mt-9 mb-0 text-26 font-semibold tracking-[-0.025em]">{arbitrator.full_name}</h1>
        <div className="mt-6 text-13.5 text-ink-2">
          {[arbitrator.current_position, arbitrator.current_organization].filter(Boolean).join(', ')}
        </div>
        <div className="mt-10 flex items-center gap-8 font-mono text-11 tracking-[0.08em]">
          <span className={`w-7 h-7 inline-block ${arbitrator.status === 'active' ? 'bg-green' : 'bg-muted-2'}`} />
          <span className={arbitrator.status === 'active' ? 'text-green' : 'text-muted-2'}>
            {arbitrator.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-rule">
        <Stat value={arbitrator.score} label="SCORE" />
        <Stat value={String(arbitrator.cases_closed_count)} label="CASES CLOSED" />
        <Stat value={arbitrator.years_of_practice ? `${arbitrator.years_of_practice}y` : '—'} label="PRACTICE" />
        <Stat
          value={String(arbitrator.assignments.filter((a) => ['ongoing', 'overdue', 'escalated'].includes(a.status)).length)}
          label="ACTIVE CASES"
        />
      </div>

      {(activeConflicts.length > 0 || canDeclareConflict) && (
        <div className="px-20 py-14 border-b border-rule">
          <div className="flex items-baseline gap-14">
            <span className="font-mono text-9.5 tracking-[0.12em] text-muted">DECLARED CONFLICTS</span>
            {canDeclareConflict && (
              <button
                type="button"
                onClick={() => setShowConflictForm((v) => !v)}
                className="ml-auto bg-transparent border-0 border-b border-ink py-2 text-12 cursor-pointer hover:text-red hover:border-red"
              >
                {showConflictForm ? 'Cancel' : 'Declare conflict'}
              </button>
            )}
          </div>

          {activeConflicts.length > 0 ? (
            <ul className="mt-8 space-y-4">
              {activeConflicts.map((c) => (
                <li key={c.id} className="text-13 text-red flex items-baseline gap-8">
                  <span className="w-7 h-7 bg-red inline-block shrink-0" />
                  {c.reason}
                </li>
              ))}
            </ul>
          ) : (
            !showConflictForm && <p className="mt-8 text-13 text-green">No declared conflicts on file.</p>
          )}

          {showConflictForm && (
            <form onSubmit={handleDeclareConflict} className="mt-12 pt-12 border-t border-hairline max-w-[420px]">
              <div className="flex gap-14">
                <label className="flex items-center gap-6 text-12.5">
                  <input
                    type="radio"
                    checked={conflictTarget === 'party'}
                    onChange={() => setConflictTarget('party')}
                  />
                  Party
                </label>
                <label className="flex items-center gap-6 text-12.5">
                  <input
                    type="radio"
                    checked={conflictTarget === 'organization'}
                    onChange={() => setConflictTarget('organization')}
                  />
                  Organization
                </label>
              </div>
              <select name="targetId" required defaultValue="" className="mt-8 w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none">
                <option value="" disabled>
                  Select {conflictTarget}
                </option>
                {(conflictTarget === 'party' ? parties : organizations).map((item) => (
                  <option key={item.id} value={item.id}>
                    {'full_name' in item ? item.full_name : item.name}
                  </option>
                ))}
              </select>
              <input
                name="reason"
                placeholder="Reason"
                required
                className="mt-8 w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
              />
              {error && <p className="mt-8 text-12.5 text-red">{error}</p>}
              <button
                type="submit"
                className="mt-10 min-h-[28px] px-12 border border-ink bg-transparent text-12 cursor-pointer hover:bg-band"
              >
                Declare
              </button>
            </form>
          )}
        </div>
      )}

      {arbitrator.bio && (
        <div className="px-20 py-14 border-b border-rule">
          <div className="font-mono text-9.5 tracking-[0.12em] text-muted">PROFESSIONAL PROFILE</div>
          <p className="mt-8 text-13.5 leading-relaxed text-ink-2">{arbitrator.bio}</p>
        </div>
      )}

      <div className="flex flex-wrap">
        <div className="flex-[1_1_260px] px-20 py-14 border-b border-rule border-r border-rule">
          <div className="font-mono text-9.5 tracking-[0.12em] text-muted">AREAS OF EXPERTISE</div>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 font-mono text-10.5 text-ink-2">
            {arbitrator.arbitrator_specializations.map((s) => (
              <span key={s.specialization}>{s.specialization.toUpperCase()}</span>
            ))}
          </div>
        </div>
        <div className="flex-[1_1_260px] px-20 py-14 border-b border-rule">
          <div className="font-mono text-9.5 tracking-[0.12em] text-muted">REGISTRATIONS</div>
          <ul className="mt-8 space-y-4 text-13">
            {(arbitrator.arbitrator_registrations ?? []).map((r) => (
              <li key={r.id}>
                {r.body}
                {r.registration_number ? ` — ${r.registration_number}` : ''}
              </li>
            ))}
            {(arbitrator.arbitrator_registrations ?? []).length === 0 && <li className="text-muted">None on file</li>}
          </ul>
        </div>
      </div>

      {(arbitrator.arbitrator_qualifications ?? []).length > 0 && (
        <div className="px-20 py-14 border-b border-rule">
          <div className="font-mono text-9.5 tracking-[0.12em] text-muted">ACADEMIC QUALIFICATIONS</div>
          <ul className="mt-8 space-y-4 text-13">
            {arbitrator.arbitrator_qualifications!.map((q) => (
              <li key={q.id}>{q.qualification}</li>
            ))}
          </ul>
        </div>
      )}

      {arbitrator.adr_experience_notes && (
        <div className="px-20 py-14 border-b border-rule">
          <div className="font-mono text-9.5 tracking-[0.12em] text-muted">ADR EXPERIENCE & TRAINING</div>
          <ul className="mt-8 space-y-4 text-13">
            {arbitrator.adr_experience_notes.split('\n').filter(Boolean).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-20 py-14">
        <div className="font-mono text-9.5 tracking-[0.12em] text-muted">ASSIGNMENT HISTORY</div>
        {arbitrator.assignments.length === 0 ? (
          <p className="mt-8 text-13 text-muted">No assignments yet.</p>
        ) : (
          <div className="mt-8">
            {arbitrator.assignments.map((a) => (
              <div key={a.id} className="py-8 border-t border-hairline flex flex-wrap gap-x-16 gap-y-4 items-baseline">
                <span className="font-mono text-12 flex-[0_0_140px]">{a.cases.case_number}</span>
                <span className="font-mono text-10.5 text-muted flex-[0_0_100px] uppercase">{a.status}</span>
                <span className="font-mono text-10.5 text-muted-2">
                  due {new Date(a.due_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 min-w-[120px] px-20 py-14 border-r border-rule last:border-r-0">
      <div className="font-mono text-14 font-medium">{value}</div>
      <div className="mt-3 font-mono text-9.5 tracking-[0.09em] text-muted">{label}</div>
    </div>
  );
}
