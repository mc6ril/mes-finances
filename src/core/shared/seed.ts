import { monthKeyOf, monthStart } from './dates';
import type {
  Account,
  BudgetPeriod,
  Category,
  CategoryGroup,
  Dataset,
  Household,
  IsoDate,
  Settings,
  WorkspaceKind,
} from './model';
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

const currentAccount = (name: string, openingDate: IsoDate): Account => ({
  id: MAIN_ACCOUNT_ID,
  name,
  kind: 'courant',
  group: 'courant',
  openingBalance: 0,
  openingDate,
  isJoint: false,
  personalSharePercent: null,
  archived: false,
  color: '#1d5ff1',
});

/** Un espace neuf n'a que son compte courant : l'utilisateur ajoute lui-même ses autres comptes. */
export const initialAccounts = (openingDate: IsoDate): Account[] => [
  currentAccount('Compte courant', openingDate),
];

export const initialSettings: Settings = {
  kind: 'perso',
  household: null,
  mode: 'simple',
  personalEnvelope: 0,
  plaisirBudget: 0,
  theme: 'system',
  mainAccountId: MAIN_ACCOUNT_ID,
  importRules: [],
};

export const DEFAULT_HOUSEHOLD: Household = {
  members: [
    { id: 'm1', name: '', salaryOnCommon: true },
    { id: 'm2', name: '', salaryOnCommon: false },
  ],
  contributionRate: 0.7,
};

export const COMMON_CATEGORIES: Category[] = [
  category('cat-salaire', 'Salaires', 'revenu'),
  category('cat-autres-entrees', 'Autres entrées', 'revenu'),
  category('cat-logement', 'Loyer et charges', 'fixe'),
  category('cat-assurances', 'Assurances', 'fixe'),
  category('cat-energie', 'Électricité et énergie', 'fixe'),
  category('cat-internet', 'Internet et téléphone', 'fixe'),
  GROCERIES_CATEGORY,
  HEALTH_CATEGORY,
  category('cat-transports', 'Transports', 'fixe'),
  TAXES_CATEGORY,
  category('cat-ep-vacances', 'Épargne vacances', 'epargne'),
  category('cat-ep-projets', 'Épargne projets', 'epargne'),
  category('cat-ep-immo', 'Épargne immobilière', 'epargne'),
  category('cat-restaurants', 'Restaurants et sorties', 'plaisir'),
  category('cat-loisirs', 'Loisirs et culture', 'plaisir'),
  category('cat-maison', 'Maison et équipement', 'plaisir'),
  category('cat-animaux', 'Animaux', 'plaisir'),
  category('cat-cadeaux', 'Cadeaux', 'plaisir'),
  category('cat-voyages', 'Vacances et week-ends', 'plaisir'),
  category('cat-divers', 'Divers', 'plaisir'),
];

const commonAccounts = (openingDate: IsoDate): Account[] => [currentAccount('Compte commun', openingDate)];

const commonSettings: Settings = {
  ...initialSettings,
  kind: 'commun',
  household: DEFAULT_HOUSEHOLD,
  mode: 'complet',
};

export const createInitialDataset = (
  today: IsoDate,
  newId: () => string,
  kind: WorkspaceKind = 'perso',
): Dataset => {
  const month = monthKeyOf(today);
  const isCommon = kind === 'commun';
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: isCommon ? commonSettings : initialSettings,
    accounts: isCommon ? commonAccounts(monthStart(month)) : initialAccounts(monthStart(month)),
    categories: isCommon ? COMMON_CATEGORIES : DEFAULT_CATEGORIES,
    transactions: [],
    savingsMovements: [],
    valuations: [],
    budgets: [{ month, planned: {}, carryOver: false }],
    yearBudgets: [{ year: month.slice(0, 4), planned: {} }],
    monthNotes: [],
    commonMonths: [],
    settlements: [],
    recurrings: [],
    goals: [],
    audit: [
      {
        id: newId(),
        at: `${today}T00:00:00.000Z`,
        action: 'creation',
        entity: 'Configuration',
        summary: 'Configuration initiale : compte courant.',
      },
    ],
  };
};
