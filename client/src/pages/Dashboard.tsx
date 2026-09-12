import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../api/cases';
import { listNotifications, markNotificationRead } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import { AppNotification, Case } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCases(), listNotifications()])
      .then(([caseData, notificationData]) => {
        setCases(caseData);
        setNotifications(notificationData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  const counts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{user?.role}</strong>
      </p>

      <section>
        <h2>Cases by status</h2>
        {Object.keys(counts).length === 0 ? (
          <p>No cases yet.</p>
        ) : (
          <ul>
            {Object.entries(counts).map(([status, count]) => (
              <li key={status}>
                {status}: {count}
              </li>
            ))}
          </ul>
        )}
        <Link to="/cases">View all cases &rarr;</Link>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Notifications</h2>
        {notifications.length === 0 ? (
          <p>No notifications.</p>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id} style={{ opacity: n.read_at ? 0.5 : 1 }}>
                {n.message}
                {!n.read_at && (
                  <button type="button" onClick={() => handleMarkRead(n.id)} style={{ marginLeft: '0.5rem' }}>
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
