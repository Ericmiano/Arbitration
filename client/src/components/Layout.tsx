import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider, useBreadcrumbValue } from '../context/BreadcrumbContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function LayoutInner() {
  const crumb = useBreadcrumbValue();
  return (
    <div className="min-h-screen grid grid-cols-[minmax(0,226px)_minmax(0,1fr)]">
      <Sidebar />
      <main className="min-w-0">
        <Topbar crumb={crumb} />
        <div className="px-26 pt-22 pb-60">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function Layout() {
  return (
    <BreadcrumbProvider>
      <LayoutInner />
    </BreadcrumbProvider>
  );
}
