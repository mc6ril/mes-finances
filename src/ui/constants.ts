import type {
  AccountGroup,
  AccountKind,
  CategoryGroup,
  SavingsMovementKind,
  WorkspaceKind,
} from '@/core/shared/model';

export const APP_VERSION = __APP_VERSION__;

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  revenu: 'Revenus',
  fixe: 'Dépenses fixes',
  epargne: 'Épargne',
  plaisir: 'Dépenses personnelles',
};

/** Libellé d'un groupe de catégories ; dans un espace commun, les dépenses variables sont communes. */
export const groupLabel = (group: CategoryGroup, kind: WorkspaceKind): string =>
  kind === 'commun' && group === 'plaisir' ? 'Dépenses communes' : GROUP_LABELS[group];

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
