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
  { path: '/compte', label: 'Compte courant', icon: Wallet, usesMonth: true, usesYear: false },
  { path: '/patrimoine', label: 'Épargne et patrimoine', icon: PiggyBank, usesMonth: false, usesYear: false },
  { path: '/bilan', label: 'Bilan annuel', icon: BarChart3, usesMonth: false, usesYear: true },
  { path: '/objectifs', label: 'Objectifs financiers', icon: Goal, usesMonth: false, usesYear: false },
  {
    path: '/parametres',
    label: 'Paramètres et sauvegardes',
    icon: Settings,
    usesMonth: false,
    usesYear: false,
  },
];
