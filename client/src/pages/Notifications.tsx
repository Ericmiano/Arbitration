import { useEffect, useState } from 'react';
import { listNotifications, markNotificationRead } from '../api/notifications';
import { AppNotification } from '../types';

export function Notifications() {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);

  function reload() {
    listNotifications().then(setNotifications);
  }

  useEffect(reload, []);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) ?? null);
  }

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Notifications</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted">
          {notifications ? `${notifications.filter((n) => !n.read_at).length} UNREAD` : 'LOADING...'}
        </div>
      </div>

      {notifications === null ? (
        <p className="px-24 py-20 text-13">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="px-24 py-20 text-13">Nothing to show.</p>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-6 items-baseline ${
              n.read_at ? 'opacity-60' : ''
            }`}
          >
            <span className="font-mono text-10 text-muted flex-[0_0_140px] uppercase">
              {n.type.replace(/_/g, ' ')}
            </span>
            <span className="flex-1 text-13.5">{n.message}</span>
            <span className="font-mono text-10 text-muted-2">{new Date(n.created_at).toLocaleString()}</span>
            {!n.read_at && (
              <button
                type="button"
                onClick={() => handleMarkRead(n.id)}
                className="bg-transparent border-0 border-b border-ink py-2 text-12 cursor-pointer hover:text-red hover:border-red"
              >
                Mark read
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
