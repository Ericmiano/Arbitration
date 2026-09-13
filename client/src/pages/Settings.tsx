import { FormEvent, useState } from 'react';
import { changePassword, updateProfile } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setNameSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      await updateProfile(String(form.get('fullName')));
      setNameSaved(true);
    } catch {
      setNameError('Could not update name');
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      await changePassword(String(form.get('currentPassword')), String(form.get('newPassword')));
      setPasswordSaved(true);
      event.currentTarget.reset();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setPasswordError(typeof message === 'string' ? message : 'Could not change password');
    }
  }

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Settings</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">{user?.email.toUpperCase()}</div>
      </div>

      <div className="px-24 py-20 border-b border-rule max-w-[420px]">
        <div className="font-mono text-9.5 tracking-[0.12em] text-muted">DISPLAY NAME</div>
        {isStaff ? (
          <>
            <form onSubmit={handleNameSubmit} className="mt-10 flex gap-10 items-end">
              <input
                name="fullName"
                defaultValue={user?.fullName}
                className="flex-1 border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
              />
              <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
                Save
              </button>
            </form>
            {nameSaved && <p className="mt-8 text-12.5 text-green">Saved.</p>}
            {nameError && <p className="mt-8 text-12.5 text-red">{nameError}</p>}
          </>
        ) : (
          <p className="mt-10 text-13 text-ink-2">
            {user?.fullName} - {user?.role === 'arbitrator' ? 'managed via your arbitrator profile' : 'managed via your party record'},
            not editable here.
          </p>
        )}
      </div>

      <div className="px-24 py-20 border-b border-rule max-w-[420px]">
        <div className="font-mono text-9.5 tracking-[0.12em] text-muted">CHANGE PASSWORD</div>
        <form onSubmit={handlePasswordSubmit} className="mt-10 flex flex-col gap-10">
          <label className="flex flex-col gap-4">
            <span className="text-12.5 text-ink-2">Current password</span>
            <input
              name="currentPassword"
              type="password"
              required
              className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
            />
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-12.5 text-ink-2">New password (min. 8 characters)</span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
            />
          </label>
          <button
            type="submit"
            className="self-start min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band"
          >
            Update password
          </button>
        </form>
        {passwordSaved && <p className="mt-8 text-12.5 text-green">Password updated.</p>}
        {passwordError && <p className="mt-8 text-12.5 text-red">{passwordError}</p>}
      </div>

      <div className="px-24 py-20 text-13.5 text-ink-2">
        Notifications, permissions and system configuration are not in this pass.
      </div>
    </div>
  );
}
