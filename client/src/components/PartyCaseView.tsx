import { Case, DocumentSummary, Hearing } from '../types';
import { documentDownloadUrl } from '../api/documents';
import {
  activeAssignment,
  activeTribunal,
  activeTribunalMembers,
  buildTimeline,
  formatMoney,
  groupKeyForCase,
  partyLine,
} from '../lib/caseDisplay';

const STEPS = ['Filed', 'Arbitrator appointed', 'Hearing & review', 'Decision'] as const;

function currentStep(c: Case): number {
  const group = groupKeyForCase(c);
  if (group === 'closed' || group === 'withdrawn') return 3;
  if (group === 'progress' || group === 'overdue') return 2;
  return 1; // appoint
}

function statusMessage(c: Case): string {
  const group = groupKeyForCase(c);
  if (group === 'withdrawn') return 'This case was withdrawn - no award or settlement was reached.';
  if (group === 'closed') {
    if (c.outcome === 'award_issued') return 'Concluded - an award has been issued.';
    if (c.outcome === 'settled') return 'Concluded - the parties reached a settlement.';
    return 'This case has concluded.';
  }
  if (group === 'overdue') return "Your case is in progress, past the date originally expected - AAK and your arbitrator are aware.";
  if (group === 'progress') return 'Your case is in progress with your appointed arbitrator.';
  if (c.basis === 'mutual_agreement' && c.status === 'pending_agreement') {
    return 'Filed - waiting on a signed submission agreement before an arbitrator can be appointed.';
  }
  return 'Filed - AAK is arranging your arbitrator.';
}

function roleLabel(role: string): string {
  switch (role) {
    case 'sole_arbitrator':
      return 'Sole arbitrator';
    case 'chairperson':
      return 'Panel chairperson';
    case 'co_arbitrator':
      return 'Panel member';
    default:
      return role.replace(/_/g, ' ');
  }
}

function friendlyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export function PartyCaseView({
  caseRecord,
  documents,
  hearings,
}: {
  caseRecord: Case;
  documents: DocumentSummary[];
  hearings: Hearing[];
}) {
  const { claimant, respondent } = partyLine(caseRecord);
  const step = currentStep(caseRecord);
  const tribunal = activeTribunal(caseRecord);
  const tribunalMembers = activeTribunalMembers(caseRecord);
  const assignment = activeAssignment(caseRecord);
  const timeline = buildTimeline(caseRecord).slice().reverse();
  const upcomingHearings = hearings
    .filter((h) => h.status === 'scheduled' && new Date(h.scheduled_at).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="bg-sheet border border-ink max-w-[760px] mx-auto">
      <div className="px-28 pt-26 pb-22 border-b border-ink">
        <div className="font-mono text-11 tracking-[0.1em] text-muted">{caseRecord.case_number}</div>
        <h1 className="mt-8 mb-0 text-24 font-semibold tracking-[-0.02em] leading-[1.3]">
          {claimant} <span className="font-normal text-16 text-muted">v.</span> {respondent}
        </h1>
        <p className="mt-14 mb-0 text-15 text-ink-2 leading-[1.5]">{statusMessage(caseRecord)}</p>
      </div>

      <div className="px-28 py-22 border-b border-rule">
        <div className="flex items-stretch">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <div key={label} className="flex-1 flex flex-col items-center text-center gap-8">
                <div className="flex items-center w-full">
                  <div className={`flex-1 h-[2px] ${i === 0 ? 'bg-transparent' : done || current ? 'bg-red' : 'bg-rule'}`} />
                  <span
                    className={`w-24 h-24 shrink-0 rounded-full flex items-center justify-center text-11 font-semibold ${
                      done ? 'bg-red text-white' : current ? 'border-2 border-red text-red' : 'border border-rule text-muted-2'
                    }`}
                  >
                    {done ? '✓' : n}
                  </span>
                  <div className={`flex-1 h-[2px] ${i === STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-red' : 'bg-rule'}`} />
                </div>
                <span className={`text-11 leading-[1.3] ${current ? 'text-ink font-semibold' : 'text-muted-2'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-28 py-22 border-b border-rule grid grid-cols-2 gap-18">
        <div>
          <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase">Dispute amount</div>
          <div className="mt-4 text-15 font-medium">{formatMoney(caseRecord.dispute_value, caseRecord.currency)}</div>
        </div>
        <div>
          <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase">Category</div>
          <div className="mt-4 text-15 font-medium capitalize">{caseRecord.category.replace(/_/g, ' ')}</div>
        </div>
        {caseRecord.project && (
          <div className="col-span-2">
            <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase">Project</div>
            <div className="mt-4 text-15 font-medium">{caseRecord.project.name}</div>
          </div>
        )}
      </div>

      <div className="px-28 py-22 border-b border-rule">
        <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase mb-10">Your arbitrator</div>
        {tribunal && tribunalMembers.length > 0 ? (
          <div className="flex flex-col gap-10">
            {tribunalMembers.map((m) => (
              <div key={m.id} className="flex items-baseline gap-10">
                <span className="text-15 font-medium">{m.arbitrator.full_name}</span>
                <span className="text-12.5 text-muted">{roleLabel(m.role)}</span>
              </div>
            ))}
          </div>
        ) : assignment ? (
          <div className="text-15 font-medium">{assignment.arbitrator.full_name}</div>
        ) : (
          <p className="text-13.5 text-muted">Not yet appointed - AAK is arranging this.</p>
        )}
      </div>

      {upcomingHearings.length > 0 && (
        <div className="px-28 py-22 border-b border-rule">
          <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase mb-10">Upcoming hearing</div>
          {upcomingHearings.map((h) => (
            <div key={h.id} className="flex flex-col gap-3">
              <span className="text-15 font-medium">{friendlyDate(h.scheduled_at)}</span>
              <span className="text-13.5 text-ink-2">
                {h.mode === 'virtual' ? 'Virtual' : 'In person'} - {h.venue_or_link}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-28 py-22 border-b border-rule">
        <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase mb-10">Documents</div>
        {documents.length === 0 ? (
          <p className="text-13.5 text-muted">No documents have been shared on this case yet.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {documents.map((d) => (
              <a
                key={d.publicId}
                href={documentDownloadUrl(d.publicId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-12 text-ink no-underline py-8 px-12 border border-rule hover:bg-band"
              >
                <span className="text-13.5 font-medium truncate">{d.fileName}</span>
                <span className="text-11.5 text-red shrink-0">Download</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="px-28 py-22">
        <div className="font-mono text-9.5 tracking-[0.1em] text-muted uppercase mb-12">What's happened so far</div>
        <div className="flex flex-col gap-16">
          {timeline.map((e, i) => (
            <div key={i} className="flex gap-14">
              <span className="flex-[0_0_120px] text-12 text-muted pt-1">{friendlyDate(e.date)}</span>
              <span className="flex-1 text-13.5">
                <span className="font-medium">{e.title}</span>
                {e.meta && <span className="text-ink-2"> - {e.meta}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
