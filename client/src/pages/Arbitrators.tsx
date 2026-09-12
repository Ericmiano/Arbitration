import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArbitrator, listArbitrators } from '../api/arbitrators';
import { Arbitrator } from '../types';

export function Arbitrators() {
  const navigate = useNavigate();
  const [arbitrators, setArbitrators] = useState<Arbitrator[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  function reload() {
    listArbitrators().then(setArbitrators);
  }

  useEffect(reload, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const listField = (name: string) =>
      String(form.get(name) || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      const email = String(form.get('email'));
      const { temporaryPassword } = await createArbitrator({
        email,
        fullName: String(form.get('fullName')),
        aakMembershipNo: String(form.get('aakMembershipNo') || '') || undefined,
        currentPosition: String(form.get('currentPosition') || '') || undefined,
        currentOrganization: String(form.get('currentOrganization') || '') || undefined,
        aakChapter: String(form.get('aakChapter') || '') || undefined,
        yearsOfPractice: form.get('yearsOfPractice') ? Number(form.get('yearsOfPractice')) : undefined,
        phone: String(form.get('phone') || '') || undefined,
        bio: String(form.get('bio') || '') || undefined,
        specializations: listField('specializations'),
        qualifications: listField('qualifications'),
      });
      setCreated({ email, password: temporaryPassword });
      setShowForm(false);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Failed to create arbitrator');
    }
  }

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-26 gap-y-18 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em] leading-[1.1]">Arbitrators</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">
            {arbitrators ? `${arbitrators.length} ON THE REGISTER` : 'LOADING...'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
        >
          {showForm ? 'Cancel' : 'Onboard arbitrator'}
        </button>
      </div>

      {created && (
        <div className="px-24 py-12 bg-band border-b border-rule text-13">
          Created <strong>{created.email}</strong> - temporary password:{' '}
          <code className="font-mono">{created.password}</code>. Share this out of band; there is no forced
          change-on-first-login flow yet.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="px-24 py-20 border-b border-rule bg-band-alt max-w-[560px]">
          <div className="grid grid-cols-2 gap-14">
            <Field label="Email"><input name="email" type="email" required className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="Full name"><input name="fullName" required className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="AAK membership no."><input name="aakMembershipNo" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="Years of practice"><input name="yearsOfPractice" type="number" min="0" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="Current position"><input name="currentPosition" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="Current organization"><input name="currentOrganization" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="AAK chapter"><input name="aakChapter" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
            <Field label="Phone"><input name="phone" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" /></Field>
          </div>
          <div className="mt-14">
            <Field label="Areas of expertise (comma separated)">
              <input name="specializations" placeholder="Arbitration, Adjudication, Construction" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" />
            </Field>
          </div>
          <div className="mt-14">
            <Field label="Academic qualifications (comma separated)">
              <input name="qualifications" placeholder="Bachelor of Laws (LLB), University of Nairobi" className="w-full border-0 border-b border-rule bg-transparent py-4 text-13 outline-none" />
            </Field>
          </div>
          <div className="mt-14">
            <Field label="Professional profile">
              <textarea name="bio" rows={3} className="w-full border border-rule bg-sheet p-8 text-13 outline-none" />
            </Field>
          </div>
          {error && <p className="mt-10 text-13 text-red">{error}</p>}
          <button
            type="submit"
            className="mt-14 min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer"
          >
            Create
          </button>
        </form>
      )}

      {arbitrators === null ? (
        <p className="px-24 py-20 text-13">Loading...</p>
      ) : arbitrators.length === 0 ? (
        <p className="px-24 py-20 text-13">No arbitrators on the register yet.</p>
      ) : (
        arbitrators.map((a) => (
          <div
            key={a.id}
            onClick={() => navigate(`/arbitrators/${a.id}`)}
            className="cursor-pointer border-b border-hairline px-24 py-14 hover:bg-row-hover flex flex-wrap gap-x-16 gap-y-4"
          >
            <div className="flex-[2_1_260px] min-w-0">
              <div className="flex items-baseline gap-8">
                <span className={`inline-block w-7 h-7 ${a.status === 'active' ? 'bg-green' : 'bg-muted-2'}`} />
                <span className="text-15 font-semibold tracking-[-0.01em]">{a.full_name}</span>
              </div>
              <div className="mt-4 text-13 text-ink-2">
                {[a.current_position, a.current_organization].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
            <div className="flex-[1_1_120px] font-mono text-10.5 text-muted">
              {a.aak_membership_no ? `AAK ${a.aak_membership_no}` : ''}
            </div>
            <div className="flex-[1_1_100px] font-mono text-10.5 text-muted">
              {a.years_of_practice ? `${a.years_of_practice} YEARS` : ''}
            </div>
            <div className="flex-[1_1_140px] font-mono text-10.5 text-muted">
              SCORE {a.score} · {a.cases_closed_count} CLOSED
            </div>
            <div className="flex-[2_1_220px] font-mono text-10.5 text-muted-2 tracking-[0.04em]">
              {a.arbitrator_specializations.map((s) => s.specialization).join(' · ')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-4">
      <span className="font-mono text-9.5 tracking-[0.11em] text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}
