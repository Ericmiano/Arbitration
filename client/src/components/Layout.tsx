import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider, useBreadcrumbValue } from '../context/BreadcrumbContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function LayoutInner() {
  const crumb = useBreadcrumbValue();
  const [navOpen, setNavOpen] = useState(false);

  // The mobile nav drawer otherwise has no keyboard way to dismiss it -
  // only a backdrop click, which a keyboard-only user can't reach.
  useEffect(() => {
    if (!navOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNavOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navOpen]);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[minmax(0,226px)_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-8 focus:left-8 focus:z-50 focus:bg-sheet focus:border focus:border-ink focus:px-14 focus:py-8 focus:text-13"
      >
        Skip to main content
      </a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="min-w-0">
        <Topbar crumb={crumb} onOpenNav={() => setNavOpen(true)} />
        <div id="main-content" className="px-16 pt-16 pb-40 md:px-26 md:pt-22 md:pb-60">
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
