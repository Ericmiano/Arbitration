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
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-26 gap-y-18 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Organizations</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">{organizations.length} ON RECORD</div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
        >
          {showForm ? 'Cancel' : 'New organization'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="px-24 py-20 border-b border-rule bg-band-alt max-w-[420px]">
          <label className="flex flex-col gap-6">
            <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Name</span>
            <input name="name" required className="w-full border-0 border-b border-rule bg-transparent py-6 text-13 outline-none" />
          </label>
          <div className="mt-14">
            <label className="flex flex-col gap-6">
              <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">Sector</span>
              <input name="sector" className="w-full border-0 border-b border-rule bg-transparent py-6 text-13 outline-none" />
            </label>
          </div>
          {error && <p className="mt-10 text-13 text-red">{error}</p>}
          <button
            type="submit"
            className="mt-16 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer hover:bg-red-hover"
          >
            Create
          </button>
        </form>
      )}

      {organizations.map((o) => (
        <div key={o.id} className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-4 items-baseline">
          <span className="flex-[1_1_260px] min-w-0 text-13.5 font-medium">{o.name}</span>
          <span className="font-mono text-10.5 tracking-[0.06em] text-muted uppercase">{o.sector}</span>
        </div>
      ))}
      {organizations.length === 0 && <p className="px-24 py-20 text-13">No organizations on record yet.</p>}
    </div>
  );
}
