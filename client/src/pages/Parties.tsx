import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-26 gap-y-18 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Parties</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">{parties.length} ON RECORD</div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
        >
          {showForm ? 'Cancel' : 'New party'}
        </button>
      </div>

      {invited && (
        <div className="px-24 py-12 bg-band border-b border-rule text-13">
          Portal access granted for <strong>{invited.email}</strong> - temporary password:{' '}
          <code className="font-mono">{invited.password}</code>
        </div>
      )}
      {error && <p className="px-24 pt-12 text-13 text-red">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="px-24 py-20 border-b border-rule bg-band-alt max-w-[420px]">
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'individual' | 'organization')}
              className={inputClass}
            >
              <option value="individual">Individual</option>
              <option value="organization">Organization</option>
            </select>
          </Field>
          {type === 'organization' && (
            <div className="mt-14">
              <Field label="Organization">
                <select name="organizationId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select
                  </option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Link
                to="/organizations"
                className="mt-6 inline-block font-mono text-10 tracking-[0.04em] border-b border-ink pb-1 hover:text-red hover:border-red"
              >
                + New organization
              </Link>
            </div>
          )}
          <div className="mt-14">
            <Field label="Full name / contact person">
              <input name="fullName" required className={inputClass} />
            </Field>
          </div>
          <div className="mt-14">
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>
          </div>
          <div className="mt-14">
            <Field label="Phone">
              <input name="phone" className={inputClass} />
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

      {parties.map((p) => (
        <div key={p.id} className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-4 items-baseline">
          <span className="flex-[1_1_220px] min-w-0 text-13.5 font-medium">{p.full_name}</span>
          <span className="flex-[0_0_120px] font-mono text-10.5 tracking-[0.06em] text-muted uppercase">{p.type}</span>
          <span className="flex-[1_1_200px] min-w-0 text-13 text-ink-2">{p.email}</span>
          <span className="ml-auto">
            {p.user_id ? (
              <span className="font-mono text-10.5 text-green">PORTAL ACCESS GRANTED</span>
            ) : (
              <button
                type="button"
                onClick={() => handleInvite(p.id)}
                className="min-h-[28px] px-12 border border-ink bg-transparent text-12 cursor-pointer hover:bg-band"
              >
                Grant access
              </button>
            )}
          </span>
        </div>
      ))}
      {parties.length === 0 && <p className="px-24 py-20 text-13">No parties on record yet.</p>}
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
