import { FormEvent, useEffect, useState } from 'react';
import { listParties } from '../api/parties';
import { createContract, createProject, listProjects } from '../api/projects';
import { Party, Project } from '../types';

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
    <div>
      <h1>Projects</h1>

      <button type="button" onClick={() => setShowProjectForm((v) => !v)}>
        {showProjectForm ? 'Cancel' : 'New Project'}
      </button>

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      {showProjectForm && (
        <form onSubmit={handleCreateProject} style={{ marginTop: '1rem', maxWidth: 420 }}>
          <div>
            <label>
              Name
              <br />
              <input name="name" required style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Sector
              <br />
              <input name="sector" style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Value
              <br />
              <input name="value" type="number" min="0" step="0.01" />
              &nbsp;
              <select name="currency" defaultValue="KES">
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>
            Create
          </button>
        </form>
      )}

      {projects.map((project) => (
        <div key={project.id} style={{ marginTop: '1.5rem', borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
          <h2>{project.name}</h2>
          <p>
            {project.sector} &middot; {project.currency} {project.value ?? '-'}
          </p>

          <h3>Contracts</h3>
          <ul>
            {project.contracts?.map((c) => (
              <li key={c.id}>
                {c.reference_number ?? c.id} - {c.has_arbitration_clause ? 'has arbitration clause' : 'no clause'}
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => setContractProjectId(contractProjectId === project.id ? null : project.id)}>
            {contractProjectId === project.id ? 'Cancel' : 'Add contract'}
          </button>

          {contractProjectId === project.id && (
            <form onSubmit={handleCreateContract} style={{ marginTop: '0.5rem', maxWidth: 420 }}>
              <div>
                <label>
                  Reference number
                  <br />
                  <input name="referenceNumber" style={{ width: '100%' }} />
                </label>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label>
                  <input type="checkbox" name="hasArbitrationClause" /> Has an arbitration clause
                </label>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label>
                  Employer / first party
                  <br />
                  <select name="employerPartyId" required defaultValue="">
                    <option value="" disabled>
                      -- select --
                    </option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label>
                  Contractor / second party
                  <br />
                  <select name="contractorPartyId" required defaultValue="">
                    <option value="" disabled>
                      -- select --
                    </option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" style={{ marginTop: '0.5rem' }}>
                Create contract
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
