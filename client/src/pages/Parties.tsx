import { FormEvent, useEffect, useState } from 'react';
import { createParty, invitePartyToPortal, listParties } from '../api/parties';
import { listOrganizations } from '../api/organizations';
import { Organization, Party } from '../types';

export function Parties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'individual' | 'organization'>('individual');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<{ email: string; password: string } | null>(null);

  function reload() {
    listParties().then(setParties);
    listOrganizations().then(setOrganizations);
  }

  useEffect(reload, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await createParty({
        type,
        organizationId: type === 'organization' ? Number(form.get('organizationId')) : undefined,
        fullName: String(form.get('fullName')),
        email: String(form.get('email') || '') || undefined,
        phone: String(form.get('phone') || '') || undefined,
      });
      setShowForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create party');
    }
  }

  async function handleInvite(partyId: string) {
    const email = window.prompt('Email to grant portal access to?');
    if (!email) return;
    try {
      const { temporaryPassword } = await invitePartyToPortal(partyId, email);
      setInvited({ email, password: temporaryPassword });
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to grant portal access');
    }
  }

  return (
    <div>
      <h1>Parties</h1>

      <button type="button" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Cancel' : 'New Party'}
      </button>

      {invited && (
        <p style={{ background: '#fffbcc', padding: '0.5rem' }}>
          Portal access granted for {invited.email} - temporary password: <code>{invited.password}</code>
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginTop: '1rem', maxWidth: 420 }}>
          <div>
            <label>
              Type
              <br />
              <select value={type} onChange={(e) => setType(e.target.value as 'individual' | 'organization')}>
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </select>
            </label>
          </div>
          {type === 'organization' && (
            <div style={{ marginTop: '0.5rem' }}>
              <label>
                Organization
                <br />
                <select name="organizationId" required>
                  <option value="" disabled>
                    -- select --
                  </option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Full name / contact person
              <br />
              <input name="fullName" required style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Email
              <br />
              <input name="email" type="email" style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>
              Phone
              <br />
              <input name="phone" style={{ width: '100%' }} />
            </label>
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>
            Create
          </button>
        </form>
      )}

      <table style={{ marginTop: '1rem', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Type</th>
            <th style={cellStyle}>Email</th>
            <th style={cellStyle}>Portal access</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id}>
              <td style={cellStyle}>{p.full_name}</td>
              <td style={cellStyle}>{p.type}</td>
              <td style={cellStyle}>{p.email}</td>
              <td style={cellStyle}>
                {p.user_id ? (
                  'Granted'
                ) : (
                  <button type="button" onClick={() => handleInvite(p.id)}>
                    Grant access
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = { border: '1px solid #ccc', padding: '0.4rem', textAlign: 'left' as const };
