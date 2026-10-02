import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listEligibleArbitrators } from '../api/arbitrators';
import { AssignmentExtension, decideExtension, listExtensions, requestExtension } from '../api/assignments';
import { confirmAgreement, getCase, getCaseTimeline } from '../api/cases';
import { documentDownloadUrl, listDocuments, uploadDocument } from '../api/documents';
import { listHearings, scheduleHearing, updateHearing } from '../api/hearings';
import { appointMember, concludeCase, createTribunal, withdrawMember } from '../api/tribunals';
import { useBreadcrumb } from '../context/BreadcrumbContext';
import { useAuth } from '../context/AuthContext';
import {
  activeAssignment as getActiveAssignment,
  activeTribunal,
  activeTribunalMembers,
  buildTimeline,
  daysBetween,
  deadlineLine,
  disputeLine,
  formatMoney,
  formatMonoDate,
  groupKeyForCase,
  isTerminalGroup,
  statusTone,
} from '../lib/caseDisplay';
import { Arbitrator, Case, CaseEvent, DocumentSummary, Hearing, TribunalMemberRole } from '../types';

const PANEL_OPEN_SEATS: Record<'sole' | 'panel', TribunalMemberRole[]> = {
  sole: ['sole_arbitrator'],
  panel: ['co_arbitrator', 'co_arbitrator', 'chairperson'],
};

function remainingSeats(tribunalType: 'sole' | 'panel', members: { role: TribunalMemberRole }[]): TribunalMemberRole[] {
  const remaining = [...PANEL_OPEN_SEATS[tribunalType]];
  for (const m of members) {
    const idx = remaining.indexOf(m.role);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}

const TABS = ['Overview', 'Parties', 'Project', 'Arbitrator', 'Documents', 'Hearings', 'Activity'] as const;
type Tab = (typeof TABS)[number];

export function CaseDetail() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [eligible, setEligible] = useState<Arbitrator[]>([]);
  const [extensions, setExtensions] = useState<AssignmentExtension[]>([]);
  const [timeline, setTimeline] = useState<CaseEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');

  function reload() {
    if (!caseId) return;
    getCase(caseId).then((c) => {
      setCaseRecord(c);
      const activeAssignment = getActiveAssignment(c);
      if (activeAssignment) {
        listExtensions(activeAssignment.id).then(setExtensions);
      } else {
        setExtensions([]);
      }
    });
    listDocuments(caseId).then(setDocuments);
    listHearings(caseId).then(setHearings);
    getCaseTimeline(caseId).then(setTimeline);
  }

  useEffect(reload, [caseId]);

  const tribunal = caseRecord ? activeTribunal(caseRecord) : undefined;
  const tribunalIsForming = tribunal?.status === 'forming';

  useEffect(() => {
    // Also refetches while a panel seat is vacant mid-case (tribunal
    // "forming" again after a withdrawal) - not just while the case itself
    // is still awaiting its first appointment.
    if (isStaff && caseId && (caseRecord?.status === 'pending_assignment' || tribunalIsForming)) {
      listEligibleArbitrators(caseId).then(setEligible);
    }
  }, [isStaff, caseRecord?.status, tribunalIsForming, caseId]);

  useBreadcrumb(caseRecord ? `DOCKET / ${caseRecord.case_number}` : undefined);

  if (!caseRecord) return <p>Loading...</p>;

  const assignment = getActiveAssignment(caseRecord);
  const group = groupKeyForCase(caseRecord);
  // The real procedural timeline, when this case has one (anything created
  // or acted on after the tribunal/timeline model shipped) - falls back to
  // the old client-side heuristic for cases with no case_events recorded
  // yet (every case imported from AAK's historical register, and any
  // legacy case nobody has touched since), rather than showing nothing.
  const displayTimeline =
    timeline.length > 0
      ? timeline.map((e) => ({
          date: e.event_at,
          title: e.title,
          meta: e.description ?? (e.actor ? `By ${e.actor.full_name}` : ''),
          tone: 'past' as const,
        }))
      : buildTimeline(caseRecord);
  const isOwningArbitrator = user?.role === 'arbitrator';
  const canActOnAssignment = assignment && (isStaff || isOwningArbitrator) && assignment.status === 'ongoing';

  async function withAsyncAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : JSON.stringify(message ?? 'Action failed'));
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const typeInput = form.elements.namedItem('documentType') as HTMLSelectElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    await withAsyncAction(async () => {
      await uploadDocument(caseId, typeInput.value, file);
      form.reset();
    });
  }

  async function handleConfirmAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const form = new FormData(event.currentTarget);
    await withAsyncAction(() => confirmAgreement(caseId, String(form.get('documentPublicId'))));
  }

  async function handleCreateTribunal(tribunalType: 'sole' | 'panel') {
    if (!caseId) return;
    await withAsyncAction(() => createTribunal(caseId, tribunalType));
  }

  async function handleAppointMember(arbitratorId: string, role: TribunalMemberRole) {
    if (!tribunal) return;
    await withAsyncAction(() => appointMember(tribunal.id, arbitratorId, role));
  }

  async function handleWithdrawMember(memberId: string) {
    const reason = window.prompt('Reason for this arbitrator leaving the tribunal?');
    if (!reason) return;
    await withAsyncAction(() => withdrawMember(tribunal!.id, memberId, reason, 'withdrawn'));
  }

  async function handleRequestExtension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) return;
    const form = new FormData(event.currentTarget);
    await withAsyncAction(() =>
      requestExtension(assignment.id, String(form.get('reason')), String(form.get('requestedDueDate'))),
    );
  }

  async function handleConclude(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const form = new FormData(event.currentTarget);
    await withAsyncAction(() =>
      concludeCase(caseId, {
        outcome: form.get('outcome') as 'award_issued' | 'settled' | 'withdrawn',
        outcomeDetail: String(form.get('outcomeDetail') || ''),
        awardChallenged: false,
      }),
    );
  }

  async function handleDecideExtension(extensionId: string, decision: 'approved' | 'rejected') {
    if (!assignment) return;
    await withAsyncAction(() => decideExtension(assignment.id, extensionId, decision));
  }

  async function handleScheduleHearing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await withAsyncAction(async () => {
      await scheduleHearing({
        caseId,
        scheduledAt: String(form.get('scheduledAt')),
        mode: form.get('mode') as 'in_person' | 'virtual',
        venueOrLink: String(form.get('venueOrLink')),
        agenda: String(form.get('agenda') || '') || undefined,
        requiredDocuments: String(form.get('requiredDocuments') || '') || undefined,
      });
      formEl.reset();
    });
  }

  async function handleHearingStatus(hearingId: string, status: 'completed' | 'cancelled') {
    await withAsyncAction(() => updateHearing(hearingId, { status }));
  }

  const dayCount =
    caseRecord.due_date && caseRecord.filed_at
      ? { elapsed: daysBetween(new Date(caseRecord.filed_at), new Date()), total: daysBetween(new Date(caseRecord.filed_at), new Date(caseRecord.due_date)) }
      : null;

  const statusLine = (() => {
    if (group === 'closed' || group === 'withdrawn') return deadlineLine(caseRecord, group);
    if (group === 'appoint') return 'AWAITING APPOINTMENT';
    const base = deadlineLine(caseRecord, group);
    return dayCount ? `${base} · DAY ${Math.max(dayCount.elapsed, 0)} OF ${dayCount.total}` : base;
  })();

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-24 gap-y-18 items-start justify-between">
        <div className="flex-[1_1_340px] min-w-0">
          <div className="font-mono text-11.5 tracking-[0.12em] text-muted">
            {caseRecord.case_number} · FILED {formatMonoDate(caseRecord.filed_at)}
          </div>
          <h1 className="mt-9 mb-0 text-26 font-semibold tracking-[-0.025em] leading-[1.2]">
            {caseRecord.parties.find((p) => p.pivot.role === 'claimant')?.full_name ?? 'Claimant'}
            <br />
            <span className="font-normal text-17 text-muted">v.</span>{' '}
            {caseRecord.parties.find((p) => p.pivot.role === 'respondent')?.full_name ?? 'Respondent'}
          </h1>
          <div className={`mt-10 flex items-center gap-8 font-mono text-11 tracking-[0.08em] ${statusTone(group)}`}>
            <span className={`w-7 h-7 inline-block ${statusTone(group).replace('text-', 'bg-')}`} />
            {statusLine}
          </div>
        </div>
        <div className="flex flex-wrap gap-8">
          <button
            type="button"
            onClick={() => setTab('Documents')}
            className="min-h-[31px] px-12 py-6 bg-transparent border border-ink text-12.5 cursor-pointer whitespace-nowrap hover:bg-band"
          >
            Upload document
          </button>
          <button
            type="button"
            onClick={() => setTab('Hearings')}
            className="min-h-[31px] px-12 py-6 bg-transparent border border-ink text-12.5 cursor-pointer whitespace-nowrap hover:bg-band"
          >
            Schedule hearing
          </button>
          {!isTerminalGroup(group) && (
            <button
              type="button"
              onClick={() => setTab('Arbitrator')}
              className="min-h-[31px] px-14 py-6 bg-red border border-red text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
            >
              {assignment ? 'Record outcome' : 'Assign arbitrator'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap border-b border-rule bg-band-alt">
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-16 py-10 text-12.5 border-0 cursor-pointer ${
                active ? 'bg-sheet font-semibold text-ink shadow-[inset_0_-2px_0_#A5121C]' : 'bg-transparent text-ink-2'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {error && <p className="px-24 pt-14 text-13 text-red">{error}</p>}

      {tab === 'Overview' && (
        <div className="flex flex-wrap">
          <div className="flex-[3_1_420px] min-w-0">
            <Titleblock caseRecord={caseRecord} />
            <ArbitratorBlock caseRecord={caseRecord} onOpenArbitratorTab={() => setTab('Arbitrator')} />
            <CaseFilePreview documents={documents} onViewAll={() => setTab('Documents')} />
          </div>
          <aside className="flex-[1_1_258px] min-w-0 border-l border-rule bg-sheet-alt">
            <div className="px-18 py-13 border-b border-rule font-mono text-9.5 tracking-[0.12em] text-muted">
              PROCEDURAL HISTORY
            </div>
            <div className="px-18 pt-15 pb-18">
              {displayTimeline.map((e, i) => (
                <div key={i} className="flex gap-10">
                  <span className="flex-[0_0_62px] font-mono text-10 tracking-[0.04em] text-muted pt-2">
                    {formatMonoDate(e.date)}
                  </span>
                  <span className="flex-[0_0_7px] flex flex-col items-center">
                    <span
                      className={`w-7 h-7 mt-5 ${
                        e.tone === 'overdue' ? 'bg-red' : e.tone === 'future' ? 'bg-green' : 'bg-timeline-dot'
                      }`}
                    />
                    <span className="w-px flex-1 min-h-[22px] bg-rule" />
                  </span>
                  <span className="flex-1 min-w-0 pb-15">
                    <span
                      className={`block text-13 font-medium ${
                        e.tone === 'overdue' ? 'text-red' : e.tone === 'future' ? 'text-green' : 'text-ink'
                      }`}
                    >
                      {e.title}
                    </span>
                    <span className="block mt-3 text-11.5 text-muted">{e.meta}</span>
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {tab === 'Parties' && (
        <div className="px-20 py-16">
          {caseRecord.parties.map((p) => (
            <div key={p.id} className="py-10 border-t border-hairline first:border-t-0">
              <span className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase">{p.pivot.role}</span>
              <div className="text-15 font-semibold">{p.full_name}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Project' && (
        <div className="px-20 py-16 text-13.5">
          {caseRecord.project ? (
            <>
              <div className="text-15 font-semibold">{caseRecord.project.name}</div>
              <div className="mt-4 text-ink-2">{caseRecord.project.location}</div>
            </>
          ) : (
            <p className="text-muted">No project linked to this case.</p>
          )}
          <div className="mt-14 font-mono text-10.5 text-muted">{disputeLine(caseRecord)}</div>
        </div>
      )}

      {tab === 'Arbitrator' && (
        <div className="px-20 py-16">
          {caseRecord.basis === 'mutual_agreement' && caseRecord.status === 'pending_agreement' && isStaff && (
            <div className="mb-20 pb-20 border-b border-rule">
              <div className="font-mono text-9.5 tracking-[0.12em] text-muted">CONFIRM SUBMISSION AGREEMENT</div>
              <p className="mt-8 text-13 text-ink-2">
                Upload the signed submission agreement in Documents first, then confirm it here using its document
                ID.
              </p>
              <form onSubmit={handleConfirmAgreement} className="mt-8 flex gap-8">
                <input
                  name="documentPublicId"
                  placeholder="Document public ID"
                  required
                  className="flex-1 border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
                />
                <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
                  Confirm
                </button>
              </form>
            </div>
          )}

          {!tribunal && isStaff && caseRecord.status === 'pending_assignment' && (
            <div className="pb-20 border-b border-rule">
              <div className="font-mono text-9.5 tracking-[0.12em] text-muted">CONSTITUTE TRIBUNAL</div>
              <p className="mt-8 text-13 text-ink-2">
                A sole arbitrator decides alone; a 3-member panel has two co-arbitrators and a chairperson.
              </p>
              <div className="mt-8 flex gap-8">
                <button
                  type="button"
                  onClick={() => handleCreateTribunal('sole')}
                  className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band"
                >
                  Sole arbitrator
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateTribunal('panel')}
                  className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band"
                >
                  3-member panel
                </button>
              </div>
            </div>
          )}

          {tribunal ? (
            <div className="mt-20">
              <div className="font-mono text-9.5 tracking-[0.12em] text-muted">
                {tribunal.tribunal_type === 'sole' ? 'SOLE ARBITRATOR' : 'ARBITRAL PANEL'} · {tribunal.status.toUpperCase()}
              </div>
              <div className="mt-8">
                {tribunal.members.map((m) => {
                  const isMemberActive = ['nominated', 'appointed', 'accepted'].includes(m.status);
                  return (
                    <div key={m.id} className="py-10 border-t border-hairline first:border-t-0 flex flex-wrap items-baseline gap-x-16 gap-y-4">
                      <Link to={`/arbitrators/${m.arbitrator_id}`} className="flex-[1_1_200px] text-14 font-semibold text-ink hover:text-red">
                        {m.arbitrator.full_name}
                      </Link>
                      <span className="font-mono text-10.5 text-muted uppercase">{m.role.replace(/_/g, ' ')}</span>
                      <span
                        className={`font-mono text-10.5 uppercase ${
                          isMemberActive ? 'text-green' : ['withdrawn', 'removed', 'recused'].includes(m.status) ? 'text-muted-2' : 'text-amber'
                        }`}
                      >
                        {m.status}
                      </span>
                      {isStaff && isMemberActive && tribunal.status !== 'dissolved' && (
                        <button
                          type="button"
                          onClick={() => handleWithdrawMember(m.id)}
                          className="ml-auto min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {tribunal.status === 'forming' && isStaff && (
                <div className="mt-20 pt-16 border-t border-rule">
                  <div className="font-mono text-9.5 tracking-[0.12em] text-muted">
                    OPEN SEAT{remainingSeats(tribunal.tribunal_type, activeTribunalMembers(caseRecord)).length === 1 ? '' : 'S'}:{' '}
                    {[...new Set(remainingSeats(tribunal.tribunal_type, activeTribunalMembers(caseRecord)))]
                      .map((r) => r.replace(/_/g, ' '))
                      .join(', ')
                      .toUpperCase()}
                  </div>
                  {eligible.length === 0 ? (
                    <p className="mt-8 text-13 text-muted">No conflict-free active arbitrators available.</p>
                  ) : (
                    <div className="mt-8">
                      {eligible.map((a) => (
                        <div key={a.id} className="py-10 border-t border-hairline flex flex-wrap items-baseline gap-x-16 gap-y-4">
                          <span className="flex-[1_1_200px] text-13.5 font-medium">{a.full_name}</span>
                          <span className="font-mono text-10.5 text-muted">SCORE {a.score}</span>
                          <span className="font-mono text-10.5 text-muted">{a.cases_closed_count} CLOSED</span>
                          {a.priorEngagementFlags && a.priorEngagementFlags.length > 0 && (
                            <span className="font-mono text-10.5 text-amber">PRIOR ENGAGEMENT</span>
                          )}
                          <div className="ml-auto flex gap-6">
                            {[...new Set(remainingSeats(tribunal.tribunal_type, activeTribunalMembers(caseRecord)))].map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => handleAppointMember(a.id, role)}
                                className="min-h-[28px] px-12 border border-ink bg-transparent text-12 cursor-pointer hover:bg-band"
                              >
                                {tribunal.tribunal_type === 'sole' ? 'Appoint' : `Appoint as ${role.replace(/_/g, ' ')}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tribunal.status === 'constituted' && (isStaff || isOwningArbitrator) && (
                <form onSubmit={handleConclude} className="mt-20 pt-16 border-t border-rule max-w-[420px]">
                  <div className="font-mono text-9.5 tracking-[0.12em] text-muted">RECORD OUTCOME</div>
                  <select name="outcome" required defaultValue="award_issued" className="mt-8 w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none">
                    <option value="award_issued">Award issued</option>
                    <option value="settled">Settled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                  <textarea
                    name="outcomeDetail"
                    placeholder="Outcome details"
                    rows={3}
                    className="mt-8 w-full border border-rule bg-transparent p-8 text-13 outline-none"
                  />
                  <button type="submit" className="mt-8 min-h-[31px] px-14 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover">
                    Mark concluded
                  </button>
                </form>
              )}
            </div>
          ) : assignment ? (
            // A case whose arbitrator predates the tribunal model on it (or
            // whose tribunal has since fully dissolved) - the plain
            // assignment record it still has.
            <div className="mt-20">
              <div className="flex flex-wrap gap-x-18 gap-y-8 items-baseline">
                <Link to={`/arbitrators/${assignment.arbitrator_id}`} className="text-16 font-semibold text-ink hover:text-red">
                  {assignment.arbitrators.full_name}
                </Link>
                <span className="font-mono text-10.5 text-muted uppercase">{assignment.status}</span>
                <span className="font-mono text-10.5 text-muted-2">due {formatMonoDate(assignment.due_date)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-20 text-13 text-muted">No arbitrator assigned yet.</p>
          )}

          {canActOnAssignment && (
            <>
              <form onSubmit={handleRequestExtension} className="mt-20 pt-16 border-t border-rule max-w-[420px]">
                <div className="font-mono text-9.5 tracking-[0.12em] text-muted">REQUEST EXTENSION</div>
                <div className="mt-8 flex flex-wrap gap-8">
                  <input name="reason" placeholder="Reason" required className="flex-1 border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" />
                  <input name="requestedDueDate" type="date" required className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" />
                  <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
                    Request
                  </button>
                </div>
              </form>

              {extensions.length > 0 && (
                <div className="mt-20 pt-16 border-t border-rule max-w-[420px]">
                  <div className="font-mono text-9.5 tracking-[0.12em] text-muted">EXTENSION REQUESTS</div>
                  <div className="mt-8">
                    {extensions.map((ext) => (
                      <div key={ext.id} className="py-8 border-t border-hairline first:border-t-0">
                        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
                          <span className="text-13">{ext.reason}</span>
                          <span className="font-mono text-10.5 text-muted-2">
                            new due {formatMonoDate(ext.new_due_date)}
                          </span>
                          <span
                            className={`font-mono text-10.5 uppercase ml-auto ${
                              ext.status === 'pending'
                                ? 'text-amber'
                                : ext.status === 'approved'
                                  ? 'text-green'
                                  : 'text-muted-2'
                            }`}
                          >
                            {ext.status}
                          </span>
                        </div>
                        {isStaff && ext.status === 'pending' && (
                          <div className="mt-6 flex gap-8">
                            <button
                              type="button"
                              onClick={() => handleDecideExtension(ext.id, 'approved')}
                              className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecideExtension(ext.id, 'rejected')}
                              className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        <div className="px-20 py-16">
          <form onSubmit={handleUpload} className="flex flex-wrap gap-8 items-center">
            <select name="documentType" defaultValue="evidence" className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none">
              <option value="contract_copy">Contract copy</option>
              <option value="evidence">Evidence</option>
              <option value="submission_agreement">Submission agreement</option>
              <option value="correspondence">Correspondence</option>
              <option value="award">Award</option>
              <option value="id_kyc">ID / KYC</option>
              <option value="other">Other</option>
            </select>
            <input name="file" type="file" required className="text-13" />
            <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
              Upload
            </button>
          </form>

          <div className="mt-14">
            {documents.map((doc) => (
              <div key={doc.publicId} className="py-11 border-t border-hairline flex flex-wrap gap-x-16 gap-y-6 items-baseline">
                <span className="flex-[1_1_250px] min-w-0 text-13.5 font-medium">{doc.fileName}</span>
                <span className="flex-[0_0_104px] font-mono text-10 tracking-[0.09em] text-muted">
                  {doc.documentType.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="flex-[0_0_132px] font-mono text-10 tracking-[0.09em] text-muted-2">
                  {doc.visibility.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="basis-full text-12 text-muted">
                  {new Date(doc.createdAt).toLocaleString()} ·{' '}
                  <a href={documentDownloadUrl(doc.publicId)}>Download</a>
                  {doc.documentType === 'submission_agreement' && <> · ID: {doc.publicId}</>}
                </span>
              </div>
            ))}
            {documents.length === 0 && <p className="py-14 text-13 text-muted">No documents uploaded yet.</p>}
          </div>
        </div>
      )}

      {tab === 'Hearings' && (
        <div className="px-20 py-16">
          {isStaff && (
            <form onSubmit={handleScheduleHearing} className="pb-20 border-b border-rule flex flex-col gap-8 max-w-[460px]">
              <div className="font-mono text-9.5 tracking-[0.12em] text-muted">SCHEDULE HEARING</div>
              <div className="flex flex-wrap gap-8">
                <input
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  className="flex-1 border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
                />
                <select name="mode" defaultValue="in_person" className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none">
                  <option value="in_person">In person</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>
              <input
                name="venueOrLink"
                placeholder="Venue or meeting link"
                required
                className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
              />
              <textarea
                name="agenda"
                placeholder="Agenda (optional)"
                rows={2}
                className="border border-rule bg-transparent p-8 text-13 outline-none"
              />
              <textarea
                name="requiredDocuments"
                placeholder="Papers required beforehand (optional)"
                rows={2}
                className="border border-rule bg-transparent p-8 text-13 outline-none"
              />
              <button type="submit" className="self-start min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
                Schedule
              </button>
            </form>
          )}

          <div className="mt-16">
            {hearings.length === 0 ? (
              <p className="text-13 text-muted">No hearings scheduled for this case.</p>
            ) : (
              hearings
                .slice()
                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                .map((h) => (
                  <div key={h.id} className="py-11 border-t border-hairline first:border-t-0 flex flex-wrap gap-x-16 gap-y-6 items-baseline">
                    <span className="flex-[0_0_170px] font-mono text-11.5">
                      {new Date(h.scheduled_at).toLocaleString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="flex-[0_0_100px] font-mono text-10 tracking-[0.09em] text-muted uppercase">
                      {h.mode.replace('_', ' ')}
                    </span>
                    <span
                      className={`flex-[0_0_100px] font-mono text-10.5 tracking-[0.06em] uppercase ${
                        h.status === 'completed' ? 'text-green' : h.status === 'cancelled' ? 'text-muted-2' : h.status === 'postponed' ? 'text-amber' : 'text-ink'
                      }`}
                    >
                      {h.status}
                    </span>
                    <span className="basis-full text-12 text-muted">{h.venue_or_link}</span>
                    {h.agenda && <span className="basis-full text-12.5 text-ink-2">{h.agenda}</span>}
                    {isStaff && h.status === 'scheduled' && (
                      <span className="flex gap-8">
                        <button
                          type="button"
                          onClick={() => handleHearingStatus(h.id, 'completed')}
                          className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
                        >
                          Mark completed
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHearingStatus(h.id, 'cancelled')}
                          className="min-h-[26px] px-10 border border-ink bg-transparent text-11.5 cursor-pointer hover:bg-band"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {tab === 'Activity' && (
        <div className="px-20 py-16">
          {displayTimeline.map((e, i) => (
            <div key={i} className="py-10 border-t border-hairline first:border-t-0 flex flex-wrap gap-x-16 gap-y-4 items-baseline">
              <span className="font-mono text-10.5 text-muted flex-[0_0_90px]">{formatMonoDate(e.date)}</span>
              <span className="flex-1 text-13.5 font-medium">{e.title}</span>
              <span className="text-12 text-muted">{e.meta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Titleblock({ caseRecord }: { caseRecord: Case }) {
  const contractClause = caseRecord.basis === 'contractual_clause' ? 'Contractual clause' : 'Mutual agreement';
  const fields: Array<{ label: string; value: string; note?: string; mono?: boolean; tone?: string }> = [
    { label: 'Project', value: caseRecord.project?.name ?? 'Not linked', note: caseRecord.project?.location ?? undefined },
    { label: 'Dispute value', value: formatMoney(caseRecord.dispute_value, caseRecord.currency), mono: true },
    { label: 'Category', value: caseRecord.category },
    {
      label: 'Claimant',
      value: caseRecord.parties.find((p) => p.pivot.role === 'claimant')?.full_name ?? '—',
    },
    {
      label: 'Respondent',
      value: caseRecord.parties.find((p) => p.pivot.role === 'respondent')?.full_name ?? '—',
    },
    { label: 'Basis for arbitration', value: contractClause },
    { label: 'SLA tier', value: caseRecord.sla_tier, mono: true },
    {
      label: 'Next date',
      value: caseRecord.due_date ? formatMonoDate(caseRecord.due_date) : '—',
      tone: groupKeyForCase(caseRecord) === 'overdue' ? 'text-red' : undefined,
    },
  ];

  return (
    <div className="flex flex-wrap border-b border-rule">
      {fields.map((f) => (
        <div key={f.label} className="flex-[1_1_172px] min-w-0 p-13 border-r border-b border-hairline -mb-px flex flex-col gap-5">
          <span className="font-mono text-9.5 tracking-[0.11em] text-muted">{f.label.toUpperCase()}</span>
          <span className={`text-14 font-medium ${f.mono ? 'font-mono' : ''} ${f.tone ?? 'text-ink'}`}>{f.value}</span>
          {f.note && <span className="text-11.5 text-muted">{f.note}</span>}
        </div>
      ))}
    </div>
  );
}

function ArbitratorBlock({ caseRecord, onOpenArbitratorTab }: { caseRecord: Case; onOpenArbitratorTab: () => void }) {
  const assignment = getActiveAssignment(caseRecord);

  return (
    <div className="px-20 pt-15 pb-14 border-b border-rule">
      <div className="font-mono text-9.5 tracking-[0.12em] text-muted">ARBITRATOR</div>
      {assignment ? (
        <>
          <div className="mt-10 flex flex-wrap gap-x-18 gap-y-8 items-baseline">
            <span className="text-16 font-semibold">{assignment.arbitrators.full_name}</span>
            <button
              type="button"
              onClick={onOpenArbitratorTab}
              className="ml-auto bg-transparent border-0 border-b border-ink py-2 text-12.5 cursor-pointer hover:text-red hover:border-red"
            >
              Open profile
            </button>
          </div>
        </>
      ) : (
        <div className="mt-10 flex items-baseline gap-18">
          <span className="text-13.5 text-muted">Not yet appointed</span>
          <button
            type="button"
            onClick={onOpenArbitratorTab}
            className="ml-auto bg-transparent border-0 border-b border-ink py-2 text-12.5 cursor-pointer hover:text-red hover:border-red"
          >
            Assign
          </button>
        </div>
      )}
    </div>
  );
}

function CaseFilePreview({ documents, onViewAll }: { documents: DocumentSummary[]; onViewAll: () => void }) {
  const preview = documents.slice(0, 4);
  return (
    <div className="px-20 pt-15 pb-6">
      <div className="flex flex-wrap gap-x-14 gap-y-8 items-baseline">
        <span className="font-mono text-9.5 tracking-[0.12em] text-muted">CASE FILE</span>
        <span className="font-mono text-10 text-muted-2">{documents.length} DOCUMENTS</span>
        <button
          type="button"
          onClick={onViewAll}
          className="ml-auto bg-transparent border-0 border-b border-ink py-2 text-12 cursor-pointer hover:text-red hover:border-red"
        >
          View all
        </button>
      </div>
      <div className="mt-10">
        {preview.map((d) => (
          <div key={d.publicId} className="py-11 border-t border-hairline flex flex-wrap gap-x-16 gap-y-6 items-baseline">
            <span className="flex-[1_1_250px] min-w-0 text-13.5 font-medium">{d.fileName}</span>
            <span className="flex-[0_0_104px] font-mono text-10 tracking-[0.09em] text-muted">
              {d.documentType.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="flex-[0_0_132px] font-mono text-10 tracking-[0.09em] text-muted-2">
              {d.visibility.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        ))}
        {preview.length === 0 && <p className="py-11 text-13 text-muted">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}
