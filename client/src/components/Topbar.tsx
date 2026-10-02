import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import { GlobalSearch } from './GlobalSearch';

export function Topbar({ crumb, onOpenNav }: { crumb: string; onOpenNav: () => void }) {
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
    <div className="bg-sheet border-b border-ink px-16 md:px-26 min-h-[54px] flex items-center flex-wrap gap-x-16 gap-y-10 sticky top-0 z-[5]">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation menu"
        className="md:hidden h-[30px] w-[30px] flex items-center justify-center bg-transparent border border-ink cursor-pointer"
      >
        <span className="sr-only">Menu</span>
        <div className="flex flex-col gap-3">
          <span className="block w-14 h-[2px] bg-ink" />
          <span className="block w-14 h-[2px] bg-ink" />
          <span className="block w-14 h-[2px] bg-ink" />
        </div>
      </button>

      <span className="font-mono text-10 tracking-[0.13em] text-muted">{crumb}</span>

      <GlobalSearch />

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
