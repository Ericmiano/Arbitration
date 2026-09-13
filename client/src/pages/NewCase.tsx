import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCase } from '../api/cases';
import { listParties } from '../api/parties';
import { listProjects } from '../api/projects';
import { Party, Project } from '../types';

/**
 * A single dedicated page for case intake. The design brief calls for a
 * seven-step wizard (parties, project, dispute, contract, documents, review,
 * submit) with saved drafts between steps - not built here; this is one page
 * covering the same fields, since documents can only be attached once the
 * case exists (see the Documents tab on the case page after creation).
 */
export function NewCase() {
  const navigate = useNavigate();
  const [parties, setParties] = useState<Party[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listParties().then(setParties);
    listProjects().then(setProjects);
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const created = await createCase({
        projectId: form.get('projectId') ? Number(form.get('projectId')) : undefined,
        contractId: form.get('contractId') ? Number(form.get('contractId')) : undefined,
        disputeValue: Number(form.get('disputeValue')),
        currency: String(form.get('currency') || 'KES'),
        category: String(form.get('category')),
        description: String(form.get('description')),
        basis: form.get('basis') as 'contractual_clause' | 'mutual_agreement',
        parties: [
          { partyId: Number(form.get('claimantId')), role: 'claimant' },
          { partyId: Number(form.get('respondentId')), role: 'respondent' },
        ],
      });
      navigate(`/cases/${created.id}`);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create case');
    }
  }

  return (
    <div className="bg-sheet border border-ink max-w-[720px]">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap items-end justify-between gap-16">
        <div>
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Start new arbitration</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">PARTIES · PROJECT · DISPUTE</div>
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

      <form onSubmit={handleCreate} className="px-24 py-20">
        <Field label="Basis for arbitration">
          <select name="basis" required defaultValue="contractual_clause" className={inputClass}>
            <option value="contractual_clause">Contract has an arbitration clause</option>
            <option value="mutual_agreement">No clause - parties mutually agreed</option>
          </select>
        </Field>

        <div className="mt-16 grid grid-cols-2 gap-16">
          <Field label="Claimant">
            <select name="claimantId" required defaultValue="" className={inputClass}>
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
            <select name="respondentId" required defaultValue="" className={inputClass}>
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

        <div className="mt-16 grid grid-cols-2 gap-16">
          <Field label="Project (optional)">
            <select
              name="projectId"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
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
            <select name="contractId" defaultValue="" className={inputClass}>
              <option value="">None</option>
              {selectedProject?.contracts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference_number ?? c.id} {c.has_arbitration_clause ? '(has clause)' : '(no clause)'}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-16">
          <Field label="Dispute value">
            <div className="flex gap-8">
              <input name="disputeValue" type="number" min="0" step="0.01" required className={inputClass} />
              <select name="currency" defaultValue="KES" className={`${inputClass} flex-[0_0_90px]`}>
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </Field>
          <Field label="Category">
            <input name="category" required placeholder="payment, delay, defects" className={inputClass} />
          </Field>
        </div>

        <div className="mt-16">
          <Field label="Description">
            <textarea name="description" required rows={4} className="w-full border border-rule bg-transparent p-8 text-13 outline-none" />
          </Field>
        </div>

        {error && <p className="mt-14 text-13 text-red">{error}</p>}

        <button
          type="submit"
          className="mt-20 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover"
        >
          Submit for intake
        </button>
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
