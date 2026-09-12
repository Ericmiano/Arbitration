import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications } from '../api/notifications';
import { useAuth } from '../context/AuthContext';

export function Topbar({ crumb }: { crumb: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    listNotifications().then((notifications) => {
      setUnreadCount(notifications.filter((n) => !n.read_at).length);
    });
  }, []);

  return (
    <div className="bg-sheet border-b border-ink px-26 min-h-[54px] flex items-center flex-wrap gap-x-16 gap-y-10 sticky top-0 z-[5]">
      <span className="font-mono text-10 tracking-[0.13em] text-muted">{crumb}</span>

      <label className="ml-auto flex items-center gap-9 border-b border-rule h-[30px] w-[250px] max-w-[40vw]">
        <span className="font-mono text-9.5 tracking-[0.12em] text-muted-2">FIND</span>
        <input
          type="text"
          placeholder="Case number, party or project"
          className="border-0 bg-transparent outline-none text-13 w-full text-ink"
        />
      </label>

      <button
        type="button"
        onClick={() => navigate('/notifications')}
        className="h-[30px] px-4 bg-transparent border-0 border-b border-transparent text-12.5 cursor-pointer flex items-center gap-7 hover:border-ink"
      >
        <span>Notifications</span>
        {unreadCount > 0 && <span className="font-mono text-11 text-red">{unreadCount}</span>}
      </button>

      {isStaff && (
        <button
          type="button"
          onClick={() => navigate('/cases/new')}
          className="min-h-[31px] px-14 py-6 bg-red border-0 text-white text-12.5 font-medium cursor-pointer whitespace-nowrap hover:bg-red-hover"
        >
          Start new arbitration
        </button>
      )}
    </div>
  );
}
