import { CSSProperties, FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCase, listCases } from '../api/cases';
import { listParties } from '../api/parties';
import { listProjects } from '../api/projects';
import { useAuth } from '../context/AuthContext';
import { Case, Party, Project } from '../types';

export function Cases() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  const [cases, setCases] = useState<Case[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  function reload() {
    listCases().then(setCases);
  }

  useEffect(() => {
    reload();
    if (isStaff) {
      listParties().then(setParties);
      listProjects().then(setProjects);
    }
  }, [isStaff]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const claimantId = Number(form.get('claimantId'));
    const respondentId = Number(form.get('respondentId'));
    const projectId = form.get('projectId') ? Number(form.get('projectId')) : undefined;
    const contractId = form.get('contractId') ? Number(form.get('contractId')) : undefined;

    try {
      await createCase({
        projectId,
        contractId,
        disputeValue: Number(form.get('disputeValue')),
        currency: String(form.get('currency') || 'KES'),
        category: String(form.get('category')),
        description: String(form.get('description')),
        basis: form.get('basis') as 'contractual_clause' | 'mutual_agreement',
        parties: [
          { partyId: claimantId, role: 'claimant' },
          { partyId: respondentId, role: 'respondent' },
        ],
      });
      setShowForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create case');
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div>
      <h1>Cases</h1>

      {isStaff && (
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New Case'}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginTop: '1rem', maxWidth: 480 }}>
          <div>
            <label>
              Basis for arbitration
              <br />
              <select name="basis" required defaultValue="contractual_clause">
                <option value="contractual_clause">Contract has an arbitration clause</option>
                <option value="mutual_agreement">No clause - parties mutually agreed</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Project (optional)
              <br />
              <select
                name="projectId"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">-- none --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Contract (required if basis = arbitration clause)
              <br />
              <select name="contractId" defaultValue="">
                <option value="">-- none --</option>
                {selectedProject?.contracts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.reference_number ?? c.id} {c.has_arbitration_clause ? '(has clause)' : '(no clause)'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Claimant
              <br />
              <select name="claimantId" required defaultValue="">
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
              Respondent
              <br />
              <select name="respondentId" required defaultValue="">
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
              Dispute value
              <br />
              <input name="disputeValue" type="number" min="0" step="0.01" required />
              &nbsp;
              <select name="currency" defaultValue="KES">
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Category
              <br />
              <input name="category" required placeholder="e.g. payment, delay, defects" />
            </label>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Description
              <br />
              <textarea name="description" required rows={4} style={{ width: '100%' }} />
            </label>
          </div>

          {error && (
            <p role="alert" style={{ color: 'crimson' }}>
              {error}
            </p>
          )}

          <button type="submit" style={{ marginTop: '0.5rem' }}>
            Create case
          </button>
        </form>
      )}

      <table style={{ marginTop: '1rem', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Case #</th>
            <th style={cellStyle}>Category</th>
            <th style={cellStyle}>Value</th>
            <th style={cellStyle}>Status</th>
            <th style={cellStyle}>Due date</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td style={cellStyle}>
                <Link to={`/cases/${c.id}`}>{c.case_number}</Link>
              </td>
              <td style={cellStyle}>{c.category}</td>
              <td style={cellStyle}>
                {c.currency} {c.dispute_value}
              </td>
              <td style={cellStyle}>{c.status}</td>
              <td style={cellStyle}>{c.due_date ? new Date(c.due_date).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: CSSProperties = { border: '1px solid #ccc', padding: '0.4rem', textAlign: 'left' };
