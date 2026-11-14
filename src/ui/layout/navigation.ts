import { BarChart3, CalendarRange, Goal, LayoutDashboard, PiggyBank, Settings, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  usesMonth: boolean;
  usesYear: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, usesMonth: false, usesYear: false },
  { path: '/budget', label: 'Budget', icon: CalendarRange, usesMonth: true, usesYear: false },
  { path: '/compte', label: 'Opérations', icon: Wallet, usesMonth: true, usesYear: false },
  { path: '/patrimoine', label: 'Épargne et patrimoine', icon: PiggyBank, usesMonth: false, usesYear: false },
  { path: '/bilan', label: 'Bilan annuel', icon: BarChart3, usesMonth: false, usesYear: true },
  { path: '/objectifs', label: 'Objectifs financiers', icon: Goal, usesMonth: false, usesYear: false },
  {
    path: '/parametres',
    label: 'Paramètres',
    icon: Settings,
    usesMonth: false,
    usesYear: false,
  },
];

export type SettingsTab = 'espace' | 'comptes' | 'categories' | 'sauvegardes' | 'compte';

export const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'espace', label: 'Espace' },
  { id: 'comptes', label: 'Comptes' },
  { id: 'categories', label: 'Catégories et règles' },
  { id: 'sauvegardes', label: 'Sauvegardes' },
  { id: 'compte', label: 'Mon compte' },
];

/** Lien direct vers un onglet des Paramètres (ex. « Paramètres → Comptes »). */
export const settingsPath = (tab: SettingsTab): string => `/parametres/${tab}`;

/** Élément du menu actif pour un chemin, sous-pages comprises (/parametres/comptes → Paramètres). */
export const navItemOf = (pathname: string): NavItem =>
  NAV_ITEMS.find(
    (item) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  ) ?? NAV_ITEMS[0]!;
