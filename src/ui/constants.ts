import type { AccountGroup, AccountKind, CategoryGroup, SavingsMovementKind } from '@/core/model';

export const APP_VERSION = __APP_VERSION__;

export const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];
export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

export const CHART_INK = {
  light: { grid: '#e7e6e2', axis: '#77766f', text: '#52514e', surface: '#ffffff' },
  dark: { grid: '#2f2f2d', axis: '#8f8e86', text: '#c3c2b7', surface: '#1c1c1b' },
};

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  revenu: 'Revenus',
  fixe: 'Dépenses fixes',
  epargne: 'Épargne',
  plaisir: 'Dépenses personnelles',
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  courant: 'Compte courant',
  livret: 'Livret réglementé',
  'assurance-vie': 'Assurance-vie',
  bourse: 'Compte-titres / PEA',
  'commun-immo': 'Épargne commune',
  autre: 'Autre',
};

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  courant: 'Compte courant',
  securise: 'Épargne sécurisée',
  investissement: 'Investissements',
};

export const MOVEMENT_LABELS: Record<SavingsMovementKind, string> = {
  versement: 'Versement',
  retrait: 'Retrait',
  interets: 'Intérêts / dividendes',
  frais: 'Frais',
};

export const PAYMENT_METHODS = ['Carte', 'Virement', 'Prélèvement', 'Espèces', 'Chèque', 'Autre'];
