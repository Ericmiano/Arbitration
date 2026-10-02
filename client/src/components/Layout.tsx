import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider, useBreadcrumbValue } from '../context/BreadcrumbContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function LayoutInner() {
  const crumb = useBreadcrumbValue();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[minmax(0,226px)_minmax(0,1fr)]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="min-w-0">
        <Topbar crumb={crumb} onOpenNav={() => setNavOpen(true)} />
        <div className="px-16 pt-16 pb-40 md:px-26 md:pt-22 md:pb-60">
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
