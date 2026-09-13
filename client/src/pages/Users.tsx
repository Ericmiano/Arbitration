import { useEffect, useState } from 'react';
import { listUsers, UserSummary } from '../api/users';

export function Users() {
  const [users, setUsers] = useState<UserSummary[] | null>(null);

  useEffect(() => {
    listUsers().then(setUsers);
  }, []);

  if (!users) return <p>Loading...</p>;

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Users</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
          {users.length} account{users.length === 1 ? '' : 's'}
        </div>
      </div>

      {users.map((u) => (
        <div key={u.id} className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-4 items-baseline">
          <span className={`w-7 h-7 inline-block ${u.status === 'active' ? 'bg-green' : 'bg-muted-2'}`} />
          <span className="flex-[1_1_220px] min-w-0 text-13.5 font-medium">{u.fullName}</span>
          <span className="flex-[1_1_220px] min-w-0 text-13 text-ink-2">{u.email}</span>
          <span className="flex-[0_0_100px] font-mono text-10.5 tracking-[0.08em] text-muted uppercase">{u.role}</span>
          <span className="flex-[0_0_160px] font-mono text-10 text-muted-2">
            {u.lastLoginAt ? `LAST SEEN ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'NEVER SIGNED IN'}
          </span>
        </div>
      ))}

      <div className="px-24 py-20 text-13.5 text-ink-2">
        Role and permission editing is not in this pass. Arbitrator and party accounts are created from the
        Arbitrators and Parties pages respectively.
      </div>
    </div>
  );
}
