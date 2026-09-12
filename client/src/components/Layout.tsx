import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div>
      <nav>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/cases">Cases</NavLink>
        <NavLink to="/arbitrators">Arbitrators</NavLink>
        <NavLink to="/documents">Documents</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
