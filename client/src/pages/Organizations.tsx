import { FormEvent, useEffect, useState } from 'react';
import { createOrganization, listOrganizations } from '../api/organizations';
import { Organization } from '../types';

export function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listOrganizations().then(setOrganizations);
  }

  useEffect(reload, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await createOrganization({
        name: String(form.get('name')),
        sector: String(form.get('sector') || '') || undefined,
      });
      setShowForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create organization');
    }
  }

  return (
    <div>
      <h1>Organizations</h1>

      <button type="button" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Cancel' : 'New Organization'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginTop: '1rem', maxWidth: 420 }}>
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
            <th style={cellStyle}>Sector</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((o) => (
            <tr key={o.id}>
              <td style={cellStyle}>{o.name}</td>
              <td style={cellStyle}>{o.sector}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = { border: '1px solid #ccc', padding: '0.4rem', textAlign: 'left' as const };
