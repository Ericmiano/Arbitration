import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const BreadcrumbContext = createContext<{ crumb: string; setCrumb: (c: string) => void } | null>(null);

function defaultCrumbFor(pathname: string): string {
  if (pathname === '/dashboard') return 'AAK / DOCKET';
  if (pathname === '/cases') return 'DOCKET / ALL CASES';
  if (pathname.startsWith('/cases/new')) return 'DOCKET / START NEW ARBITRATION';
  if (pathname.startsWith('/cases/')) return 'DOCKET / CASE';
  if (pathname === '/arbitrators') return 'AAK / ARBITRATORS';
  if (pathname === '/documents') return 'AAK / DOCUMENTS';
  if (pathname === '/hearings') return 'AAK / HEARINGS';
  if (pathname === '/reports') return 'AAK / REPORTS';
  if (pathname === '/users') return 'AAK / USERS';
  if (pathname === '/settings') return 'AAK / SETTINGS';
  if (pathname === '/notifications') return 'AAK / NOTIFICATIONS';
  return 'AAK / DOCKET';
}

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [crumb, setCrumb] = useState(() => defaultCrumbFor(location.pathname));

  // Reset to the route's default whenever the path changes; a page can then
  // override it (e.g. CaseDetail sets the real case number once it loads).
  useEffect(() => {
    setCrumb(defaultCrumbFor(location.pathname));
  }, [location.pathname]);

  return <BreadcrumbContext.Provider value={{ crumb, setCrumb }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumb(override?: string) {
  const context = useContext(BreadcrumbContext);
  if (!context) throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  const { setCrumb } = context;
  useEffect(() => {
    if (override) setCrumb(override);
  }, [override, setCrumb]);
}

export function useBreadcrumbValue() {
  const context = useContext(BreadcrumbContext);
  if (!context) throw new Error('useBreadcrumbValue must be used within a BreadcrumbProvider');
  return context.crumb;
}
