import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { listArbitrators } from '../api/arbitrators';
import { listCases } from '../api/cases';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  count?: string;
  /** matches the active tint on a broader set of paths, e.g. /cases/:id under /cases */
  matchPrefix?: string;
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const location = useLocation();
  const isActive = item.matchPrefix
    ? location.pathname.startsWith(item.matchPrefix)
    : location.pathname === item.to;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-12 min-h-[34px] pr-18 py-8 text-13.5 no-underline ${
        isActive ? 'bg-nav-bg-active text-nav-text-active' : 'text-nav-text hover:text-nav-text-active'
      }`}
    >
      <span className={`self-stretch w-[2px] ${isActive ? 'bg-red' : 'bg-transparent'}`} />
      <span className="flex-1">{item.label}</span>
      {item.count !== undefined && (
        <span className={`font-mono text-10.5 ${isActive ? 'text-nav-count-active' : 'text-nav-count'}`}>
          {item.count}
        </span>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  /** Mobile drawer state - the sidebar is always visible at md+ regardless of this. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [caseCount, setCaseCount] = useState<string>('');
  const [arbitratorCount, setArbitratorCount] = useState<string>('');
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await logout();
      onClose();
      navigate('/login');
    } catch {
      setSignOutError('Could not sign out - try again.');
    }
  }

  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  useEffect(() => {
    if (!isStaff) return;
    listCases({ perPage: 1 }).then((page) => setCaseCount(String(page.total)));
    listArbitrators().then((arbitrators) => setArbitratorCount(String(arbitrators.length)));
  }, [isStaff]);

  const primary: NavItem[] = isStaff
    ? [
        { to: '/dashboard', label: 'Docket' },
        { to: '/cases', label: 'Cases', count: caseCount, matchPrefix: '/cases' },
        { to: '/arbitrators', label: 'Arbitrators', count: arbitratorCount },
        { to: '/documents', label: 'Documents' },
        { to: '/hearings', label: 'Hearings' },
        { to: '/reports', label: 'Reports' },
      ]
    : [
        { to: '/dashboard', label: 'Home' },
        { to: '/cases', label: user?.role === 'party' ? 'My case' : 'My cases', matchPrefix: '/cases' },
        { to: '/documents', label: 'Documents' },
        { to: '/hearings', label: 'Hearings' },
      ];

  const secondary: NavItem[] = isStaff
    ? [
        { to: '/users', label: 'Users' },
        ...(user?.role === 'admin' ? [{ to: '/audit-log', label: 'Audit log' }] : []),
        { to: '/settings', label: 'Settings' },
      ]
    : [{ to: '/settings', label: 'Profile' }];

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 bg-ink/40 z-10 md:hidden"
        />
      )}
      <nav
        aria-label="Main"
        className={`bg-nav-bg text-nav-text flex flex-col fixed inset-y-0 left-0 w-[226px] z-20 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:sticky md:top-0 md:h-screen ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-18 pt-20 pb-16 border-b border-nav-border">
          <div className="font-mono text-15 font-semibold tracking-[0.16em] text-nav-text-active">
            A<span className="text-red">A</span>K
          </div>
          <div className="mt-5 font-mono text-9.5 tracking-[0.14em] text-nav-muted">
            ARBITRATION REGISTER
          </div>
        </div>

        <div className="pt-14 pb-4">
          {primary.map((item) => (
            <NavRow key={item.to + item.label} item={item} onNavigate={onClose} />
          ))}
        </div>

        <div className="mt-12 pt-12 pb-4 border-t border-nav-border">
          {secondary.map((item) => (
            <NavRow key={item.to + item.label} item={item} onNavigate={onClose} />
          ))}
        </div>

        <div className="mt-auto px-18 py-15 border-t border-nav-border">
          <div className="text-12.5 text-nav-text-active">{user?.fullName ?? 'AAK'}</div>
          <div className="mt-3 font-mono text-9.5 tracking-[0.1em] text-nav-muted uppercase">
            {roleLabel(user?.role)}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-10 bg-transparent border-0 p-0 font-mono text-9.5 tracking-[0.1em] text-nav-count uppercase cursor-pointer hover:text-nav-text-active"
          >
            Sign out
          </button>
          {signOutError && <div className="mt-6 text-11.5 text-red">{signOutError}</div>}
        </div>
      </nav>
    </>
  );
}

function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'registrar':
      return 'Registrar';
    case 'staff':
      return 'Staff';
    case 'arbitrator':
      return 'Arbitrator';
    case 'party':
      return 'Party';
    default:
      return '';
  }
}
