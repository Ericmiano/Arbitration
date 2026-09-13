import { FormEvent, useEffect, useState } from 'react';
import { createUser, listUsers, updateUser, UserSummary } from '../api/users';
import { useAuth } from '../context/AuthContext';

const EDITABLE_ROLES = ['admin', 'registrar', 'staff'];

export function Users() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function reload() {
    listUsers().then(setUsers);
  }

  useEffect(reload, []);

  async function handleChange(userId: string, patch: { role?: string; status?: string }) {
    setError(null);
    setSavingId(userId);
    try {
      await updateUser(userId, patch);
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Could not update this account.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await createUser({
        email: String(form.get('email')),
        fullName: String(form.get('fullName')),
        role: form.get('role') as 'admin' | 'registrar' | 'staff',
      });
      event.currentTarget.reset();
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : 'Could not create this account.');
    }
  }

  if (!users) return <p>Loading...</p>;

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Users</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
          {users.length} account{users.length === 1 ? '' : 's'}
        </div>
      </div>

      {error && <p className="px-24 pt-14 text-13 text-red">{error}</p>}

      {isAdmin && (
        <form onSubmit={handleCreate} className="px-24 py-16 border-b border-rule bg-band-alt flex flex-wrap gap-8 items-center">
          <div className="basis-full font-mono text-9.5 tracking-[0.12em] text-muted">NEW USER</div>
          <input
            name="fullName"
            placeholder="Full name"
            required
            className="flex-[1_1_180px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="flex-[1_1_220px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
          />
          <select name="role" defaultValue="staff" className="border-0 border-b border-rule bg-transparent py-4 text-13 outline-none">
            <option value="staff">Staff</option>
            <option value="registrar">Registrar</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
            Create &amp; send setup link
          </button>
        </form>
      )}

      {users.map((u) => {
        const isEditableRole = EDITABLE_ROLES.includes(u.role);
        const isSelf = currentUser && String(currentUser.id) === String(u.id);
        const canEdit = isAdmin && isEditableRole && !isSelf;

        return (
          <div key={u.id} className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-8 items-center">
            <span className={`w-7 h-7 inline-block ${u.status === 'active' ? 'bg-green' : 'bg-muted-2'}`} />
            <span className="flex-[1_1_220px] min-w-0 text-13.5 font-medium">
              {u.fullName}
              {isSelf && <span className="ml-8 font-mono text-10 text-muted-2 uppercase">you</span>}
            </span>
            <span className="flex-[1_1_220px] min-w-0 text-13 text-ink-2">{u.email}</span>

            {canEdit ? (
              <select
                value={u.role}
                disabled={savingId === u.id}
                onChange={(e) => handleChange(u.id, { role: e.target.value })}
                className="flex-[0_0_120px] border-0 border-b border-rule bg-transparent py-2 font-mono text-10.5 tracking-[0.08em] uppercase outline-none"
              >
                <option value="admin">Admin</option>
                <option value="registrar">Registrar</option>
                <option value="staff">Staff</option>
              </select>
            ) : (
              <span className="flex-[0_0_100px] font-mono text-10.5 tracking-[0.08em] text-muted uppercase">{u.role}</span>
            )}

            {canEdit ? (
              <select
                value={u.status}
                disabled={savingId === u.id}
                onChange={(e) => handleChange(u.id, { status: e.target.value })}
                className="flex-[0_0_120px] border-0 border-b border-rule bg-transparent py-2 font-mono text-10.5 tracking-[0.08em] uppercase outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            ) : (
              <span className="flex-[0_0_160px] font-mono text-10 text-muted-2">
                {u.lastLoginAt ? `LAST SEEN ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'NEVER SIGNED IN'}
              </span>
            )}
          </div>
        );
      })}

      <div className="px-24 py-20 text-13.5 text-ink-2">
        {isAdmin
          ? 'Role and status apply to admin/registrar/staff accounts only. Arbitrator and party accounts are managed from the Arbitrators and Parties pages respectively.'
          : 'Role and status editing is available to administrators. Arbitrator and party accounts are created from the Arbitrators and Parties pages respectively.'}
      </div>
    </div>
  );
}
