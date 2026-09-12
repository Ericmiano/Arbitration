import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  return (
    <div>
      <nav>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/cases">Cases</NavLink>
        {isStaff && <NavLink to="/arbitrators">Arbitrators</NavLink>}
        {isStaff && <NavLink to="/parties">Parties</NavLink>}
        {isStaff && <NavLink to="/organizations">Organizations</NavLink>}
        {isStaff && <NavLink to="/projects">Projects</NavLink>}
        <span style={{ marginLeft: 'auto' }}>
          {user?.role} &nbsp;
          <button type="button" onClick={() => logout()}>
            Log out
          </button>
        </span>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
