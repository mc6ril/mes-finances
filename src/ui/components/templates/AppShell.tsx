import { Menu, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useSyncErrorNotice } from '@/hooks/useSyncErrorNotice';
import Brand from '@/ui/components/atoms/Brand';
import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';
import AccountMenu from '@/ui/components/organisms/layout/AccountMenu';
import BackupReminderBanner from '@/ui/components/organisms/layout/BackupReminderBanner';
import OfflineBanner from '@/ui/components/organisms/layout/OfflineBanner';
import PeriodPicker from '@/ui/components/organisms/layout/PeriodPicker';
import Toasts from '@/ui/components/organisms/layout/Toasts';
import WorkspaceSwitcher from '@/ui/components/organisms/layout/WorkspaceSwitcher';
import { APP_VERSION } from '@/ui/constants';
import { cx } from '@/ui/design-system/cx';
import { NAV_ITEMS, navItemOf } from '@/ui/routing/navigation';

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
              ? 'bg-accent-soft-strong text-accent-ink-strong'
              : 'text-ink-secondary-soft hover:bg-surface-muted hover:text-ink',
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

type AppShellProps = { children: ReactNode };

const AppShell = ({ children }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useSyncErrorNotice();
  const current = navItemOf(location.pathname);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on remonte en haut de page à chaque changement de page.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <BackupReminderBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-line-card bg-sidebar-translucent px-3 py-5 backdrop-blur-sm lg:flex">
          <Brand />
          <NavList />
          <SidebarFooter />
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-scrim" onClick={() => setMenuOpen(false)} aria-hidden />
            <aside className="relative flex h-full w-72 flex-col gap-6 bg-sidebar px-3 py-5 shadow-xl animate-in">
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
          <header className="sticky top-0 z-30 border-b border-line-header bg-page/85 backdrop-blur-sm">
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
