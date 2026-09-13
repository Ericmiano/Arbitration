import { FormEvent, useEffect, useState } from 'react';
import { listParties } from '../api/parties';
import { createContract, createProject, listProjects } from '../api/projects';
import { Party, Project } from '../types';
import { formatMoney } from '../lib/caseDisplay';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [contractProjectId, setContractProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listProjects().then(setProjects);
    listParties().then(setParties);
  }

  useEffect(reload, []);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await createProject({
        name: String(form.get('name')),
        sector: String(form.get('sector') || '') || undefined,
        value: form.get('value') ? Number(form.get('value')) : undefined,
        currency: String(form.get('currency') || 'KES'),
      });
      setShowProjectForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create project');
    }
  }

  async function handleCreateContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractProjectId) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const employerPartyId = Number(form.get('employerPartyId'));
    const contractorPartyId = Number(form.get('contractorPartyId'));

    try {
      await createContract(contractProjectId, {
        referenceNumber: String(form.get('referenceNumber') || '') || undefined,
        currency: String(form.get('currency') || 'KES'),
        hasArbitrationClause: form.get('hasArbitrationClause') === 'on',
        parties: [
          { partyId: employerPartyId, role: 'employer' },
          { partyId: contractorPartyId, role: 'contractor' },
        ],
      });
      setContractProjectId(null);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create contract');
    }
  }

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-26 gap-y-18 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Projects</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">{projects.length} ON RECORD</div>
        </div>
        <button
          type="button"
          onClick={() => setShowProjectForm((v) => !v)}
          className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
        >
          {showProjectForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {error && <p className="px-24 pt-12 text-13 text-red">{error}</p>}

      {showProjectForm && (
        <form onSubmit={handleCreateProject} className="px-24 py-20 border-b border-rule bg-band-alt max-w-[420px]">
          <Field label="Name">
            <input name="name" required className={inputClass} />
          </Field>
          <div className="mt-14">
            <Field label="Sector">
              <input name="sector" className={inputClass} />
            </Field>
          </div>
          <div className="mt-14">
            <Field label="Value">
              <div className="flex gap-8">
                <input name="value" type="number" min="0" step="0.01" className={inputClass} />
                <select name="currency" defaultValue="KES" className={`${inputClass} flex-[0_0_90px]`}>
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </Field>
          </div>
          <button
            type="submit"
            className="mt-16 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover"
          >
            Create
          </button>
        </form>
      )}

      {projects.map((project) => (
        <div key={project.id} className="border-b border-hairline px-24 py-18">
          <div className="text-15 font-semibold tracking-[-0.01em]">{project.name}</div>
          <div className="mt-4 font-mono text-10.5 text-muted uppercase">
            {project.sector} {project.sector && '·'} {project.value ? formatMoney(project.value, project.currency) : ''}
          </div>

          <div className="mt-14">
            <div className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Contracts</div>
            {project.contracts && project.contracts.length > 0 ? (
              <div className="mt-8">
                {project.contracts.map((c) => (
                  <div key={c.id} className="py-6 border-t border-hairline text-13 flex items-baseline gap-8">
                    <span className="font-mono">{c.reference_number ?? c.id}</span>
                    <span className={c.has_arbitration_clause ? 'text-green' : 'text-muted'}>
                      {c.has_arbitration_clause ? 'Has arbitration clause' : 'No arbitration clause'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-13 text-muted">No contracts yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setContractProjectId(contractProjectId === project.id ? null : project.id)}
            className="mt-12 bg-transparent border-0 border-b border-ink py-2 text-12.5 cursor-pointer hover:text-red hover:border-red"
          >
            {contractProjectId === project.id ? 'Cancel' : 'Add contract'}
          </button>

          {contractProjectId === project.id && (
            <form onSubmit={handleCreateContract} className="mt-14 max-w-[420px] p-16 bg-band-alt">
              <Field label="Reference number">
                <input name="referenceNumber" className={inputClass} />
              </Field>
              <label className="mt-14 flex items-center gap-8 text-13">
                <input type="checkbox" name="hasArbitrationClause" /> Has an arbitration clause
              </label>
              <div className="mt-14 grid grid-cols-2 gap-14">
                <Field label="Employer / first party">
                  <select name="employerPartyId" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Select
                    </option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Contractor / second party">
                  <select name="contractorPartyId" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Select
                    </option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="submit"
                className="mt-16 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover"
              >
                Create contract
              </button>
            </form>
          )}
        </div>
      ))}
      {projects.length === 0 && <p className="px-24 py-20 text-13">No projects on record yet.</p>}
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
