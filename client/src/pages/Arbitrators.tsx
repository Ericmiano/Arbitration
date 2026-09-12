import { FormEvent, useEffect, useState } from 'react';
import { createArbitrator, listArbitrators } from '../api/arbitrators';
import { Arbitrator } from '../types';

export function Arbitrators() {
  const [arbitrators, setArbitrators] = useState<Arbitrator[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);

  function reload() {
    listArbitrators().then(setArbitrators);
  }

  useEffect(reload, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const specializations = String(form.get('specializations') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const email = String(form.get('email'));
      const { temporaryPassword } = await createArbitrator({
        email,
        fullName: String(form.get('fullName')),
        credentials: String(form.get('credentials') || '') || undefined,
        specializations,
      });
      setCreatedCredential({ email, password: temporaryPassword });
      setShowForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create arbitrator');
    }
  }

  return (
    <div>
      <h1>Arbitrators</h1>

      <button type="button" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Cancel' : 'Onboard arbitrator'}
      </button>

      {createdCredential && (
        <p style={{ background: '#fffbcc', padding: '0.5rem' }}>
          Created {createdCredential.email} - temporary password: <code>{createdCredential.password}</code>.
          Share this with them out of band; they should change it after first login.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginTop: '1rem', maxWidth: 420 }}>
          <div>
            <label>
              Email
              <br />
              <input name="email" type="email" required style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Full name
              <br />
              <input name="fullName" required style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Credentials
              <br />
              <textarea name="credentials" rows={3} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Specializations (comma separated)
              <br />
              <input name="specializations" placeholder="construction, commercial" style={{ width: '100%' }} />
            </label>
          </div>
          {error && (
            <p role="alert" style={{ color: 'crimson' }}>
              {error}
            </p>
          )}
          <button type="submit" style={{ marginTop: '0.5rem' }}>
            Create
          </button>
        </form>
      )}

      <table style={{ marginTop: '1rem', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Status</th>
            <th style={cellStyle}>Score</th>
            <th style={cellStyle}>Cases closed</th>
            <th style={cellStyle}>Specializations</th>
          </tr>
        </thead>
        <tbody>
          {arbitrators.map((a) => (
            <tr key={a.id}>
              <td style={cellStyle}>{a.full_name}</td>
              <td style={cellStyle}>{a.status}</td>
              <td style={cellStyle}>{a.score}</td>
              <td style={cellStyle}>{a.cases_closed_count}</td>
              <td style={cellStyle}>{a.arbitrator_specializations.map((s) => s.specialization).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = { border: '1px solid #ccc', padding: '0.4rem', textAlign: 'left' as const };
