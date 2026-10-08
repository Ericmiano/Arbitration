import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCase } from '../api/cases';
import { uploadDocument } from '../api/documents';
import { listParties } from '../api/parties';
import { listProjects } from '../api/projects';
import { formatMoney } from '../lib/caseDisplay';
import { Party, Project } from '../types';

const DOCUMENT_TYPES: Record<string, string> = {
  contract_copy: 'Contract copy',
  evidence: 'Evidence',
  submission_agreement: 'Submission agreement',
  correspondence: 'Correspondence',
  award: 'Award',
  id_kyc: 'ID / KYC',
  other: 'Other',
};

interface StagedDocument {
  id: string;
  file: File;
  documentType: string;
}

/**
 * Case intake as one sectioned page (Parties / Project & contract / Dispute
 * / Documents) with a review step before the actual submit fires - not the
 * full routed, draft-persisting wizard from the design brief, which would
 * be its own project on top of everything else here.
 */
export function NewCase() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [parties, setParties] = useState<Party[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [basis, setBasis] = useState<'contractual_clause' | 'mutual_agreement'>('contractual_clause');
  const [claimantId, setClaimantId] = useState('');
  const [respondentId, setRespondentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contractId, setContractId] = useState('');
  const [disputeValue, setDisputeValue] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [stagedDocs, setStagedDocs] = useState<StagedDocument[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('evidence');
  const [fileInputKey, setFileInputKey] = useState(0);

  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listParties().then(setParties);
    listProjects().then(setProjects);
  }, []);

  const selectedProject = projects.find((p) => p.id === projectId);
  const claimant = parties.find((p) => p.id === claimantId);
  const respondent = parties.find((p) => p.id === respondentId);
  const contract = selectedProject?.contracts?.find((c) => c.id === contractId);

  function handleAddDocument() {
    if (!pendingFile) return;
    setStagedDocs((docs) => [...docs, { id: crypto.randomUUID(), file: pendingFile, documentType: pendingType }]);
    setPendingFile(null);
    setFileInputKey((k) => k + 1);
  }

  function handleRemoveDocument(id: string) {
    setStagedDocs((docs) => docs.filter((d) => d.id !== id));
  }

  function handleGoToReview() {
    if (!formRef.current?.reportValidity()) return;
    setError(null);
    setReviewing(true);
  }

  async function handleConfirmSubmit() {
    setSubmitting(true);
    setError(null);
    let created;
    try {
      created = await createCase({
        projectId: projectId ? Number(projectId) : undefined,
        contractId: contractId ? Number(contractId) : undefined,
        disputeValue: Number(disputeValue),
        currency,
        category,
        description,
        basis,
        parties: [
          { partyId: Number(claimantId), role: 'claimant' },
          { partyId: Number(respondentId), role: 'respondent' },
        ],
      });
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create case');
      setSubmitting(false);
      return;
    }

    // The case now exists - a failed attachment past this point must not
    // block navigation (retrying here would create a second, duplicate
    // case). Documents can always be added from the case page instead.
    for (const doc of stagedDocs) {
      try {
        await uploadDocument(created.id, doc.documentType, doc.file);
      } catch {
        // best-effort; the user still lands on the case either way
      }
    }
    navigate(`/cases/${created.id}`);
  }

  if (reviewing) {
    return (
      <div className="bg-sheet border border-ink max-w-[720px]">
        <div className="px-24 pt-22 pb-18 border-b border-ink">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Review before filing</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">
            Nothing is saved yet - check the details below, then confirm.
          </div>
        </div>

        <div className="px-24 py-20 flex flex-col gap-20">
          <ReviewSection title="Parties">
            <ReviewRow label="Claimant" value={claimant?.full_name ?? '—'} />
            <ReviewRow label="Respondent" value={respondent?.full_name ?? '—'} />
          </ReviewSection>

          <ReviewSection title="Project & contract">
            <ReviewRow label="Basis" value={basis === 'contractual_clause' ? 'Contract has an arbitration clause' : 'No clause - parties mutually agreed'} />
            <ReviewRow label="Project" value={selectedProject?.name ?? 'None'} />
            <ReviewRow label="Contract" value={contract ? (contract.reference_number ?? String(contract.id)) : 'None'} />
          </ReviewSection>

          <ReviewSection title="Dispute">
            <ReviewRow label="Dispute value" value={disputeValue ? formatMoney(disputeValue, currency) : '—'} />
            <ReviewRow label="Category" value={category || '—'} />
            <ReviewRow label="Description" value={description || '—'} multiline />
          </ReviewSection>

          <ReviewSection title="Documents">
            {stagedDocs.length === 0 ? (
              <p className="text-13 text-muted">No documents attached - you can add these from the case page afterwards.</p>
            ) : (
              <ul className="m-0 pl-0 list-none flex flex-col gap-6">
                {stagedDocs.map((d) => (
                  <li key={d.id} className="text-13 flex gap-8 items-baseline">
                    <span className="font-medium">{d.file.name}</span>
                    <span className="font-mono text-10.5 text-muted uppercase">{DOCUMENT_TYPES[d.documentType]}</span>
                  </li>
                ))}
              </ul>
            )}
          </ReviewSection>

          {error && <p role="alert" className="text-13 text-red">{error}</p>}

          <div className="flex gap-12">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={submitting}
              className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band disabled:cursor-not-allowed"
            >
              Back to edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover disabled:cursor-not-allowed disabled:bg-red-hover"
            >
              {submitting ? 'Filing...' : 'Confirm & file arbitration'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sheet border border-ink max-w-[720px]">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap items-end justify-between gap-16">
        <div>
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Start new arbitration</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">PARTIES · PROJECT · DISPUTE · DOCUMENTS</div>
        </div>
        <div className="flex gap-14 font-mono text-10.5 tracking-[0.04em]">
          <Link to="/parties" className="border-b border-ink pb-1 hover:text-red hover:border-red">
            + New party
          </Link>
          <Link to="/projects" className="border-b border-ink pb-1 hover:text-red hover:border-red">
            + New project/contract
          </Link>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleGoToReview();
        }}
        className="px-24 py-20 flex flex-col gap-24"
      >
        <FormSection title="Parties">
          <div className="grid grid-cols-2 gap-16">
            <Field label="Claimant">
              <select
                value={claimantId}
                onChange={(e) => setClaimantId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select a party
                </option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Respondent">
              <select
                value={respondentId}
                onChange={(e) => setRespondentId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select a party
                </option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Project & contract">
          <Field label="Basis for arbitration">
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as 'contractual_clause' | 'mutual_agreement')}
              required
              className={inputClass}
            >
              <option value="contractual_clause">Contract has an arbitration clause</option>
              <option value="mutual_agreement">No clause - parties mutually agreed</option>
            </select>
          </Field>
          <div className="mt-16 grid grid-cols-2 gap-16">
            <Field label="Project (optional)">
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setContractId('');
                }}
                className={inputClass}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contract">
              <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {selectedProject?.contracts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.reference_number ?? c.id} {c.has_arbitration_clause ? '(has clause)' : '(no clause)'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Dispute">
          <div className="grid grid-cols-2 gap-16">
            <Field label="Dispute value">
              <div className="flex gap-8">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={disputeValue}
                  onChange={(e) => setDisputeValue(e.target.value)}
                  className={inputClass}
                />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputClass} flex-[0_0_90px]`}>
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </Field>
            <Field label="Category">
              <input
                required
                placeholder="payment, delay, defects"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-16">
            <Field label="Description">
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-rule bg-transparent p-8 text-13 outline-none"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Documents (optional)">
          <p className="mt-0 mb-14 text-12.5 text-ink-2">
            Attach anything already on hand - these upload once the case is filed. You can always add more from the
            case page afterwards.
          </p>
          <div className="flex flex-wrap gap-8 items-center">
            <select value={pendingType} onChange={(e) => setPendingType(e.target.value)} className={inputClass}>
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              key={fileInputKey}
              type="file"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              className="text-13"
            />
            <button
              type="button"
              onClick={handleAddDocument}
              disabled={!pendingFile}
              className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band disabled:cursor-not-allowed disabled:text-muted-3"
            >
              Attach
            </button>
          </div>

          {stagedDocs.length > 0 && (
            <ul className="mt-14 m-0 pl-0 list-none flex flex-col gap-8">
              {stagedDocs.map((d) => (
                <li key={d.id} className="text-13 flex flex-wrap gap-8 items-baseline">
                  <span className="font-medium">{d.file.name}</span>
                  <span className="font-mono text-10.5 text-muted uppercase">{DOCUMENT_TYPES[d.documentType]}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(d.id)}
                    className="ml-auto bg-transparent border-0 border-b border-ink py-1 text-11.5 cursor-pointer hover:text-red hover:border-red"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        {error && <p role="alert" className="text-13 text-red">{error}</p>}

        <div>
          <button
            type="submit"
            className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover"
          >
            Review before filing
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass = 'w-full border-0 border-b border-rule bg-transparent py-6 text-13 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-6">
      <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-20 first:border-t-0 first:pt-0">
      <h2 className="m-0 mb-14 font-mono text-10.5 tracking-[0.12em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="m-0 mb-8 font-mono text-9.5 tracking-[0.12em] text-muted uppercase">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex gap-12 items-baseline">
      <span className="flex-[0_0_140px] font-mono text-10.5 text-muted uppercase">{label}</span>
      <span className={`flex-1 text-13.5 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</span>
    </div>
  );
}
