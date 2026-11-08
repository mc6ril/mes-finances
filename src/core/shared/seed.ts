import { monthKeyOf, monthStart } from './dates';
import type { Account, BudgetPeriod, Category, CategoryGroup, Dataset, IsoDate, Settings } from './model';
import { SCHEMA_VERSION } from './model';

export const ANNUAL_CATEGORY_IDS = ['cat-voyages', 'cat-cadeaux', 'cat-exceptionnelles'];

const periodOf = (id: string): BudgetPeriod => {
  if (ANNUAL_CATEGORY_IDS.includes(id)) {
    return 'annuel';
  }
  return 'mensuel';
};

const category = (id: string, name: string, group: CategoryGroup): Category => ({
  id,
  name,
  group,
  period: periodOf(id),
  archived: false,
});

export const TAXES_CATEGORY: Category = {
  id: 'cat-impots',
  name: 'Impôts et taxes',
  group: 'fixe',
  period: 'mensuel',
  archived: false,
};

export const GROCERIES_CATEGORY: Category = {
  id: 'cat-courses',
  name: 'Courses et alimentation',
  group: 'fixe',
  period: 'mensuel',
  archived: false,
};

export const HEALTH_CATEGORY: Category = {
  id: 'cat-sante',
  name: 'Santé',
  group: 'fixe',
  period: 'mensuel',
  archived: false,
};

export const DEFAULT_CATEGORIES: Category[] = [
  category('cat-salaire', 'Salaire', 'revenu'),
  category('cat-primes', 'Primes', 'revenu'),
  category('cat-remboursements', 'Remboursements', 'revenu'),
  category('cat-revenus-complementaires', 'Revenus complémentaires', 'revenu'),
  category('cat-autres-entrees', 'Autres entrées', 'revenu'),
  category('cat-compte-commun', 'Participation au compte commun', 'fixe'),
  category('cat-logement', 'Logement', 'fixe'),
  category('cat-assurances', 'Assurances', 'fixe'),
  category('cat-abonnements', 'Abonnements', 'fixe'),
  category('cat-telephone', 'Téléphone', 'fixe'),
  category('cat-transports', 'Transports', 'fixe'),
  GROCERIES_CATEGORY,
  HEALTH_CATEGORY,
  TAXES_CATEGORY,
  category('cat-autres-charges', 'Autres charges récurrentes', 'fixe'),
  category('cat-ep-livret-a', 'Livret A', 'epargne'),
  category('cat-ep-ldds', 'LDDS', 'epargne'),
  category('cat-ep-assurance-vie', 'Assurance-vie', 'epargne'),
  category('cat-ep-trade-republic', 'Trade Republic', 'epargne'),
  category('cat-ep-immo', 'Épargne commune immobilière', 'epargne'),
  category('cat-ep-autres', 'Autres placements', 'epargne'),
  category('cat-restaurants', 'Restaurants et sorties', 'plaisir'),
  category('cat-shopping', 'Shopping', 'plaisir'),
  category('cat-loisirs', 'Jeux vidéo et loisirs', 'plaisir'),
  category('cat-achats-en-ligne', 'Achats en ligne', 'plaisir'),
  category('cat-cadeaux', 'Cadeaux', 'plaisir'),
  category('cat-voyages', 'Voyages', 'plaisir'),
  category('cat-exceptionnelles', 'Dépenses exceptionnelles', 'plaisir'),
  category('cat-divers', 'Divers', 'plaisir'),
];

export const MAIN_ACCOUNT_ID = 'acc-courant';

export const initialAccounts = (openingDate: IsoDate): Account[] => [
  {
    id: MAIN_ACCOUNT_ID,
    name: 'Compte courant',
    kind: 'courant',
    group: 'courant',
    openingBalance: 0,
    openingDate,
    isJoint: false,
    personalSharePercent: null,
    archived: false,
    color: '#1d5ff1',
  },
  {
    id: 'acc-ldds',
    name: 'LDDS',
    kind: 'livret',
    group: 'securise',
    openingBalance: 0,
    openingDate,
    isJoint: false,
    personalSharePercent: null,
    archived: false,
    color: '#10b981',
  },
  {
    id: 'acc-livret-a',
    name: 'Livret A',
    kind: 'livret',
    group: 'securise',
    openingBalance: 0,
    openingDate,
    isJoint: false,
    personalSharePercent: null,
    archived: false,
    color: '#14b8a6',
  },
  {
    id: 'acc-assurance-vie',
    name: 'Assurance-vie',
    kind: 'assurance-vie',
    group: 'investissement',
    openingBalance: 0,
    openingDate,
    isJoint: false,
    personalSharePercent: null,
    archived: false,
    color: '#8b5cf6',
  },
  {
    id: 'acc-trade-republic',
    name: 'Trade Republic',
    kind: 'bourse',
    group: 'investissement',
    openingBalance: 0,
    openingDate,
    isJoint: false,
    personalSharePercent: null,
    archived: false,
    color: '#f59e0b',
  },
  {
    id: 'acc-immo-commun',
    name: 'Épargne immobilière commune',
    kind: 'commun-immo',
    group: 'securise',
    openingBalance: 0,
    openingDate,
    isJoint: true,
    personalSharePercent: null,
    archived: false,
    color: '#ec4899',
  },
];

export const initialSettings: Settings = {
  mode: 'simple',
  personalEnvelope: 0,
  plaisirBudget: 0,
  theme: 'system',
  mainAccountId: MAIN_ACCOUNT_ID,
};

export const createInitialDataset = (today: IsoDate, newId: () => string): Dataset => {
  const month = monthKeyOf(today);
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: initialSettings,
    accounts: initialAccounts(monthStart(month)),
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    savingsMovements: [],
    valuations: [],
    budgets: [{ month, planned: {}, carryOver: false }],
    yearBudgets: [{ year: month.slice(0, 4), planned: {} }],
    recurrings: [],
    goals: [],
    audit: [
      {
        id: newId(),
        at: `${today}T00:00:00.000Z`,
        action: 'creation',
        entity: 'Configuration',
        summary: 'Configuration initiale : comptes de départ.',
      },
    ],
  };
};
