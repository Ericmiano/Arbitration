import { useState } from 'react';
import { Case, DocumentSummary, Hearing } from '../types';
import { documentDownloadUrl, uploadDocument } from '../api/documents';
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

const UPLOAD_TYPES: Record<string, string> = {
  evidence: 'Supporting evidence',
  contract_copy: 'Contract copy',
  correspondence: 'Correspondence',
  other: 'Other document',
};

// Matches this server's php.ini upload_max_filesize (20M) - checked
// client-side so a party gets a clear reason instead of a silent "A file is
// required" from a PHP-level truncation.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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
  onDocumentUploaded,
}: {
  caseRecord: Case;
  documents: DocumentSummary[];
  hearings: Hearing[];
  onDocumentUploaded?: () => void;
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

  const [uploadType, setUploadType] = useState('evidence');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploadedName(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`"${file.name}" is too large - the limit is 20MB per file.`);
      setFileInputKey((k) => k + 1);
      return;
    }
    setUploading(true);
    try {
      await uploadDocument(String(caseRecord.id), uploadType, file);
      setUploadedName(file.name);
      onDocumentUploaded?.();
    } catch {
      setUploadError('Could not upload that file - check it is a PDF, Word document, or image and try again.');
    } finally {
      setUploading(false);
      setFileInputKey((k) => k + 1);
    }
  }

  return (
    <div className="bg-sheet border border-ink max-w-[760px] mx-auto">
      <div className="px-26 pt-26 pb-22 border-b border-ink">
        <div className="font-mono text-13 font-semibold tracking-[0.1em] text-muted">{caseRecord.case_number}</div>
        <h1 className="mt-8 mb-0 text-27 font-semibold tracking-[-0.02em] leading-[1.3]">
          {claimant} <span className="font-medium text-19 text-muted">v.</span> {respondent}
        </h1>
        <p className="mt-14 mb-0 text-17 font-medium text-ink-2 leading-[1.5]">{statusMessage(caseRecord)}</p>
      </div>

      <div className="px-26 py-22 border-b border-rule">
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
                    className={`w-30 h-30 shrink-0 rounded-full flex items-center justify-center text-13 font-bold ${
                      done ? 'bg-red text-white' : current ? 'border-2 border-red text-red' : 'border border-rule text-muted-2'
                    }`}
                  >
                    {done ? '✓' : n}
                  </span>
                  <div className={`flex-1 h-[2px] ${i === STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-red' : 'bg-rule'}`} />
                </div>
                <span className={`text-13 leading-[1.3] ${current ? 'text-ink font-bold' : 'text-muted-2 font-medium'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-26 py-22 border-b border-rule grid grid-cols-2 gap-18">
        <div>
          <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase">Dispute amount</div>
          <div className="mt-4 text-17 font-semibold">{formatMoney(caseRecord.dispute_value, caseRecord.currency)}</div>
        </div>
        <div>
          <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase">Category</div>
          <div className="mt-4 text-17 font-semibold capitalize">{caseRecord.category.replace(/_/g, ' ')}</div>
        </div>
        {caseRecord.project && (
          <div className="col-span-2">
            <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase">Project</div>
            <div className="mt-4 text-17 font-semibold">{caseRecord.project.name}</div>
          </div>
        )}
      </div>

      <div className="px-26 py-22 border-b border-rule">
        <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase mb-10">Your arbitrator</div>
        {tribunal && tribunalMembers.length > 0 ? (
          <div className="flex flex-col gap-10">
            {tribunalMembers.map((m) => (
              <div key={m.id} className="flex items-baseline gap-10">
                <span className="text-17 font-semibold">{m.arbitrator.full_name}</span>
                <span className="text-14 font-medium text-muted">{roleLabel(m.role)}</span>
              </div>
            ))}
          </div>
        ) : assignment ? (
          <div className="text-17 font-semibold">{assignment.arbitrator.full_name}</div>
        ) : (
          <p className="text-15 font-medium text-muted">Not yet appointed - AAK is arranging this.</p>
        )}
      </div>

      {upcomingHearings.length > 0 && (
        <div className="px-26 py-22 border-b border-rule">
          <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase mb-10">Upcoming hearing</div>
          {upcomingHearings.map((h) => (
            <div key={h.id} className="flex flex-col gap-3">
              <span className="text-17 font-semibold">{friendlyDate(h.scheduled_at)}</span>
              <span className="text-15 font-medium text-ink-2">
                {h.mode === 'virtual' ? 'Virtual' : 'In person'} - {h.venue_or_link}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-26 py-22 border-b border-rule">
        <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase mb-10">Documents</div>
        {documents.length === 0 ? (
          <p className="text-15 font-medium text-muted">No documents have been shared on this case yet.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {documents.map((d) => (
              <a
                key={d.publicId}
                href={documentDownloadUrl(d.publicId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-12 text-ink no-underline py-10 px-12 border border-rule hover:bg-band"
              >
                <span className="text-15 font-semibold truncate">{d.fileName}</span>
                <span className="text-13.5 font-bold text-red shrink-0">Download</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-16 pt-16 border-t border-rule">
          <div className="text-13.5 font-medium text-ink-2 mb-10">
            Add a document or supporting evidence
          </div>
          <div className="flex flex-wrap items-center gap-10">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              disabled={uploading}
              className="border border-rule bg-sheet py-8 px-10 text-13.5"
            >
              {Object.entries(UPLOAD_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="min-h-[31px] px-14 py-6 bg-red text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover inline-flex items-center">
              {uploading ? 'Uploading...' : 'Choose file'}
              <input
                key={fileInputKey}
                type="file"
                disabled={uploading}
                onChange={(e) => handleFileChosen(e.target.files?.[0])}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
              />
            </label>
          </div>
          <p className="mt-8 text-11.5 text-muted">PDF, Word, or image - max 20MB per file.</p>
          {uploadedName && (
            <p className="mt-8 text-12.5 font-medium text-ink-2">"{uploadedName}" was uploaded.</p>
          )}
          {uploadError && (
            <p role="alert" className="mt-8 text-12.5 font-medium text-red">
              {uploadError}
            </p>
          )}
        </div>
      </div>

      <div className="px-26 py-22">
        <div className="font-mono text-11.5 font-semibold tracking-[0.1em] text-muted uppercase mb-12">What's happened so far</div>
        <div className="flex flex-col gap-16">
          {timeline.map((e, i) => (
            <div key={i} className="flex gap-14">
              <span className="flex-[0_0_120px] text-14 font-medium text-muted pt-2">{friendlyDate(e.date)}</span>
              <span className="flex-1 text-15 font-medium">
                <span className="font-semibold">{e.title}</span>
                {e.meta && <span className="text-ink-2"> - {e.meta}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
