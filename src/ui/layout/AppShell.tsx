import { CloudOff, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { useSyncErrorNotice } from '@/hooks/useSyncErrorNotice';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { useToast } from '@/hooks/useToast';
import { useReport } from '@/hooks/useReport';
import { APP_VERSION } from '@/ui/constants';
import Button from '@/ui/design-system/Button';
import { Select } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';
import { cx } from '@/ui/design-system/cx';
import AccountMenu from './AccountMenu';
import Brand from './Brand';
import { NAV_ITEMS } from './navigation';
import PeriodPicker from './PeriodPicker';

type NavListProps = { onNavigate?: () => void };

const NavList = ({ onNavigate }: NavListProps) => (
  <nav className="flex flex-col gap-0.5" aria-label="Navigation principale">
    {NAV_ITEMS.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        onClick={onNavigate}
        className={({ isActive }) =>
          cx(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        {item.label}
      </NavLink>
    ))}
  </nav>
);

const SidebarFooter = () => (
  <div className="mt-auto flex flex-col gap-3">
    <WorkspaceSwitcher />
    <AccountMenu />
    <Text variant="caption" className="px-3">
      Version {APP_VERSION}
    </Text>
  </div>
);

const WorkspaceSwitcher = () => {
  const { workspaces, workspace } = useFinanceState();
  const store = useFinanceStore();
  const report = useReport();
  if (workspaces.length < 2) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5 border-t border-stone-200/80 px-2 pt-4 dark:border-stone-800">
      <Text variant="label" className="px-1">
        Espace
      </Text>
      <Select
        value={workspace.id}
        onChange={(workspaceId) => void report(store.switchWorkspace(workspaceId))}
        label="Espace affiché"
        className="h-9"
        options={workspaces.map((item) => ({
          value: item.id,
          label: item.name,
        }))}
      />
    </div>
  );
};

/** Hors ligne, la saisie continue : les modifications partent au retour du réseau. */
const OfflineBanner = () => {
  const { offline, pendingWrites } = useSyncStatus();
  if (!offline) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <CloudOff className="h-3.5 w-3.5" aria-hidden />
      {pendingWrites > 0
        ? `Hors ligne : ${pendingWrites} modification${pendingWrites > 1 ? 's' : ''} en attente, envoyée${pendingWrites > 1 ? 's' : ''} au retour du réseau.`
        : 'Hors ligne : tu peux continuer, tes modifications seront envoyées au retour du réseau.'}
    </div>
  );
};

const Toasts = () => {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-60 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={cx(
            'pointer-events-auto animate-in rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg ring-1',
            toast.tone === 'error' &&
              'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900',
            toast.tone === 'success' &&
              'bg-white text-stone-800 ring-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700',
            toast.tone === 'info' &&
              'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900',
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
};

type AppShellProps = { children: ReactNode };

const AppShell = ({ children }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useSyncErrorNotice();
  const current = NAV_ITEMS.find((item) => item.path === location.pathname) ?? NAV_ITEMS[0];
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-stone-200/80 bg-white/70 px-3 py-5 backdrop-blur-sm dark:border-stone-800 dark:bg-[#161615] lg:flex">
          <Brand />
          <NavList />
          <SidebarFooter />
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-stone-950/40"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <aside className="relative flex h-full w-72 flex-col gap-6 bg-white px-3 py-5 shadow-xl animate-in dark:bg-[#161615]">
              <div className="flex items-center justify-between">
                <Brand />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setMenuOpen(false)}
                  label="Fermer le menu"
                />
              </div>
              <NavList onNavigate={() => setMenuOpen(false)} />
              <SidebarFooter />
            </aside>
          </div>
        )}
        {/* overflow-x-clip : filet de sécurité contre le défilement latéral, sans casser l’en-tête collant. */}
        <div className="min-w-0 flex-1 overflow-x-clip">
          <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-[#f6f6f3]/85 backdrop-blur-sm dark:border-stone-800 dark:bg-[#121211]/85">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Menu}
                  onClick={() => setMenuOpen(true)}
                  label="Ouvrir le menu"
                  className="lg:hidden"
                />
                <Text variant="strong" className="lg:hidden">
                  {current?.label}
                </Text>
              </div>
              {current?.usesMonth && <PeriodPicker mode="month" />}
              {current?.usesYear && <PeriodPicker mode="year" />}
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">{children}</main>
        </div>
      </div>
      <Toasts />
    </div>
  );
};

export default AppShell;
