import { isSavingsAccount } from '../comptes/accounts';
import { isCounted } from '../comptes/balances';
import { monthKeyOf, monthsOfYear } from '../shared/dates';
import type {
  Account,
  Category,
  CategoryGroup,
  Cents,
  MonthBudget,
  MonthKey,
  Transaction,
  YearBudget,
} from '../shared/model';

export type CategoryActual = { actual: Cents; upcoming: Cents };

const CONTRIBUTING_TYPES: Record<CategoryGroup, Transaction['type'][]> = {
  revenu: ['revenu'],
  fixe: ['depense'],
  plaisir: ['depense'],
  epargne: ['investissement', 'virement', 'depense'],
};

const contributionOf = (group: CategoryGroup, transaction: Transaction): Cents => {
  if (!CONTRIBUTING_TYPES[group].includes(transaction.type)) {
    return 0;
  }
  if (group === 'revenu') {
    return transaction.amount;
  }
  return -transaction.amount;
};

/** Dépense payée par le commun mais à la charge d'un membre : hors budget du commun. */
const isChargedToMember = (transaction: Transaction): boolean => transaction.imputation?.kind === 'charge';

export const inMonth = (transactions: Transaction[], month: MonthKey): Transaction[] =>
  transactions.filter((transaction) => monthKeyOf(transaction.date) === month);

export const categoryActuals = (
  transactions: Transaction[],
  categories: Category[],
  month: MonthKey,
): Record<string, CategoryActual> => {
  const groups = new Map(categories.map((category) => [category.id, category.group]));
  const result: Record<string, CategoryActual> = {};
  inMonth(transactions, month).forEach((transaction) => {
    const group = groups.get(transaction.categoryId ?? '');
    if (!group || !transaction.categoryId || isChargedToMember(transaction)) {
      return;
    }
    const contribution = contributionOf(group, transaction);
    if (contribution === 0) {
      return;
    }
    const entry = result[transaction.categoryId] ?? { actual: 0, upcoming: 0 };
    if (isCounted(transaction)) {
      entry.actual += contribution;
    } else {
      entry.upcoming += contribution;
    }
    result[transaction.categoryId] = entry;
  });
  return result;
};

export type LineStatus = 'ok' | 'attention' | 'depasse';

export type BudgetLine = {
  categoryId: string;
  name: string;
  group: CategoryGroup;
  planned: Cents;
  carriedOver: Cents;
  available: Cents;
  actual: Cents;
  upcoming: Cents;
  gap: Cents;
  progress: number;
  previousActual: Cents;
  status: LineStatus;
};

/** Seuil d'alerte unique : une dépense passe « presque atteinte » à 80 % de son budget. */
export const SPENDING_ALERT_THRESHOLD = 0.8;

/**
 * Part du budget utilisée (barres de progression). Une dépense sans budget compte comme un budget
 * entièrement utilisé : elle est déjà un dépassement, la barre ne doit pas rester vide.
 */
export const budgetUsage = (actual: Cents, budget: Cents): number => {
  if (budget <= 0) {
    return actual > 0 ? 1 : 0;
  }
  return actual / budget;
};

/** État d'une dépense face à son budget : dans le budget, presque atteint (80 %) ou dépassé. */
export const spendingStatus = (actual: Cents, budget: Cents): LineStatus => {
  if (actual > budget) {
    return 'depasse';
  }
  if (budget > 0 && actual < budget && actual / budget >= SPENDING_ALERT_THRESHOLD) {
    return 'attention';
  }
  return 'ok';
};

const expenseStatus = (available: Cents, actual: Cents): LineStatus => spendingStatus(actual, available);

/** Seules les dépenses ont une limite : revenus et épargne n'ont ni alerte ni dépassement. */
export const hasSpendingLimit = (group: CategoryGroup): boolean => group === 'fixe' || group === 'plaisir';

const incomeStatus = (planned: Cents, actual: Cents): LineStatus => {
  if (actual >= planned) {
    return 'ok';
  }
  return 'attention';
};

const carryFrom = (
  categoryId: string,
  previousBudget: MonthBudget | null,
  previousActuals: Record<string, CategoryActual>,
): Cents => {
  const planned = previousBudget?.planned[categoryId] ?? 0;
  const spent = previousActuals[categoryId]?.actual ?? 0;
  return Math.max(0, planned - spent);
};

type BudgetLinesInput = {
  budget: MonthBudget;
  previousBudget: MonthBudget | null;
  categories: Category[];
  transactions: Transaction[];
};

export const budgetLines = ({
  budget,
  previousBudget,
  categories,
  transactions,
}: BudgetLinesInput): BudgetLine[] => {
  const actuals = categoryActuals(transactions, categories, budget.month);
  const previousMonth = previousBudget?.month ?? '';
  const previousActuals = categoryActuals(transactions, categories, previousMonth);
  return categories
    .filter(isMonthly)
    .filter(
      (category) =>
        !category.archived || (budget.planned[category.id] ?? 0) !== 0 || actuals[category.id] !== undefined,
    )
    .map((category) => {
      const planned = budget.planned[category.id] ?? 0;
      const carriedOver = carriedOverFor(category, budget, previousBudget, previousActuals);
      const available = planned + carriedOver;
      const actual = actuals[category.id]?.actual ?? 0;
      const upcoming = actuals[category.id]?.upcoming ?? 0;
      const isIncome = category.group === 'revenu';
      const statusOf = STATUS_BY_GROUP[category.group];
      return {
        categoryId: category.id,
        name: category.name,
        group: category.group,
        planned,
        carriedOver,
        available,
        actual,
        upcoming,
        gap: lineGap(isIncome, available, actual),
        progress: budgetUsage(actual, available),
        previousActual: previousActuals[category.id]?.actual ?? 0,
        status: statusOf(available, actual),
      };
    });
};

const carriedOverFor = (
  category: Category,
  budget: MonthBudget,
  previousBudget: MonthBudget | null,
  previousActuals: Record<string, CategoryActual>,
): Cents => {
  if (!budget.carryOver || category.group !== 'plaisir') {
    return 0;
  }
  return carryFrom(category.id, previousBudget, previousActuals);
};

const lineGap = (isIncome: boolean, available: Cents, actual: Cents): Cents => {
  if (isIncome) {
    return actual - available;
  }
  return available - actual;
};

const fixedStatus = (available: Cents, actual: Cents): LineStatus => {
  if (actual > available) {
    return 'depasse';
  }
  return 'ok';
};

const STATUS_BY_GROUP: Record<CategoryGroup, (available: Cents, actual: Cents) => LineStatus> = {
  revenu: incomeStatus,
  fixe: fixedStatus,
  epargne: expenseStatus,
  plaisir: expenseStatus,
};

export type MonthTotals = {
  revenus: Cents;
  fixes: Cents;
  plaisir: Cents;
  plaisirMensuel: Cents;
  epargne: Cents;
  nonCategorise: Cents;
  depenses: Cents;
};

const GROUP_TO_TOTAL: Record<CategoryGroup, keyof MonthTotals> = {
  revenu: 'revenus',
  fixe: 'fixes',
  plaisir: 'plaisir',
  epargne: 'epargne',
};

export const monthTotals = (
  transactions: Transaction[],
  categories: Category[],
  month: MonthKey,
): MonthTotals => {
  const totals: MonthTotals = {
    revenus: 0,
    fixes: 0,
    plaisir: 0,
    plaisirMensuel: 0,
    epargne: 0,
    nonCategorise: 0,
    depenses: 0,
  };
  const actuals = categoryActuals(transactions, categories, month);
  categories.forEach((category) => {
    const actual = actuals[category.id]?.actual ?? 0;
    totals[GROUP_TO_TOTAL[category.group]] += actual;
    if (category.group === 'plaisir' && isMonthly(category)) {
      totals.plaisirMensuel += actual;
    }
  });
  const known = new Set(categories.map((category) => category.id));
  totals.nonCategorise = inMonth(transactions, month)
    .filter((transaction) => transaction.type === 'depense' && isCounted(transaction))
    .filter((transaction) => !isChargedToMember(transaction))
    .filter((transaction) => !known.has(transaction.categoryId ?? ''))
    .reduce((total, transaction) => total - transaction.amount, 0);
  totals.depenses = totals.fixes + totals.plaisir + totals.nonCategorise;
  return totals;
};

export const plaisirBudgetOf = (
  budget: MonthBudget | null,
  categories: Category[],
  fallback: Cents,
): Cents => {
  if (!budget) {
    return fallback;
  }
  const plaisirIds = categories
    .filter((category) => category.group === 'plaisir' && isMonthly(category))
    .map((category) => category.id);
  const lines = plaisirIds
    .map((id) => budget.planned[id])
    .filter((value): value is number => value !== undefined);
  if (lines.length === 0) {
    return fallback;
  }
  return lines.reduce((total, value) => total + value, 0);
};

export const isMonthly = (category: Category): boolean => category.period !== 'annuel';

export const isAnnual = (category: Category): boolean => category.period === 'annuel';

export type AnnualLine = {
  categoryId: string;
  name: string;
  group: CategoryGroup;
  planned: Cents;
  actual: Cents;
  upcoming: Cents;
  remaining: Cents;
  progress: number;
  monthlyProvision: Cents;
  status: LineStatus;
};

type AnnualLinesInput = {
  yearBudget: YearBudget | null;
  categories: Category[];
  transactions: Transaction[];
  year: number;
};

export const annualLines = ({
  yearBudget,
  categories,
  transactions,
  year,
}: AnnualLinesInput): AnnualLine[] => {
  const perMonth = monthsOfYear(year).map((month) => categoryActuals(transactions, categories, month));
  return categories
    .filter(isAnnual)
    .filter(
      (category) =>
        !category.archived ||
        (yearBudget?.planned[category.id] ?? 0) !== 0 ||
        perMonth.some((actuals) => actuals[category.id] !== undefined),
    )
    .map((category) => {
      const planned = yearBudget?.planned[category.id] ?? 0;
      const actual = perMonth.reduce((total, actuals) => total + (actuals[category.id]?.actual ?? 0), 0);
      const upcoming = perMonth.reduce((total, actuals) => total + (actuals[category.id]?.upcoming ?? 0), 0);
      return {
        categoryId: category.id,
        name: category.name,
        group: category.group,
        planned,
        actual,
        upcoming,
        remaining: planned - actual,
        progress: budgetUsage(actual, planned),
        monthlyProvision: Math.round(planned / 12),
        status: expenseStatus(planned, actual),
      };
    });
};

export const provisionPerMonth = (yearBudget: YearBudget | null, categories: Category[]): Cents => {
  if (!yearBudget) {
    return 0;
  }
  const annualIds = new Set(
    categories.filter((category) => isAnnual(category) && !category.archived).map((category) => category.id),
  );
  const total = Object.entries(yearBudget.planned)
    .filter(([categoryId]) => annualIds.has(categoryId))
    .reduce((sum, [, value]) => sum + value, 0);
  return Math.round(total / 12);
};

export type Effective<T, K> = { budget: T; inheritedFrom: K | null };

const latestBefore = <T>(items: T[], keyOf: (item: T) => string, target: string): T | null =>
  items
    .filter((item) => keyOf(item) < target)
    .reduce<T | null>((latest, item) => {
      if (!latest || keyOf(item) > keyOf(latest)) {
        return item;
      }
      return latest;
    }, null);

export const effectiveBudget = (
  budgets: MonthBudget[],
  month: MonthKey,
): Effective<MonthBudget, MonthKey> => {
  const own = budgets.find((budget) => budget.month === month);
  if (own) {
    return { budget: own, inheritedFrom: null };
  }
  const source = latestBefore(budgets, (budget) => budget.month, month);
  if (!source) {
    return { budget: { month, planned: {}, carryOver: false }, inheritedFrom: null };
  }
  return {
    budget: { month, planned: { ...source.planned }, carryOver: source.carryOver },
    inheritedFrom: source.month,
  };
};

export const effectiveYearBudget = (
  yearBudgets: YearBudget[],
  year: string,
): Effective<YearBudget | null, string> => {
  const own = yearBudgets.find((budget) => budget.year === year);
  if (own) {
    return { budget: own, inheritedFrom: null };
  }
  const source = latestBefore(yearBudgets, (budget) => budget.year, year);
  if (!source) {
    return { budget: null, inheritedFrom: null };
  }
  return { budget: { year, planned: { ...source.planned } }, inheritedFrom: source.year };
};

export const groupTotal = (
  lines: BudgetLine[],
  group: CategoryGroup,
  key: 'available' | 'actual' | 'upcoming',
): Cents => lines.filter((line) => line.group === group).reduce((total, line) => total + line[key], 0);

export type MonthBudgetSummary = {
  income: Cents;
  plannedIncome: Cents;
  /** Charges fixes + dépenses personnelles + dépenses des budgets annuels du mois. */
  spending: Cents;
  /** Prévu des charges fixes et dépenses personnelles + provision des budgets annuels. */
  plannedSpending: Cents;
  saving: Cents;
  plannedSaving: Cents;
  balance: Cents;
  plannedBalance: Cents;
};

/** Résumé du mois (espace perso) : revenus, dépenses et épargne, en réel et en prévu, et le solde. */
export const monthBudgetSummary = (
  lines: BudgetLine[],
  provision: Cents,
  annualSpent: Cents,
): MonthBudgetSummary => {
  const income = groupTotal(lines, 'revenu', 'actual');
  const plannedIncome = groupTotal(lines, 'revenu', 'available');
  const spending = groupTotal(lines, 'fixe', 'actual') + groupTotal(lines, 'plaisir', 'actual') + annualSpent;
  const plannedSpending =
    provision + groupTotal(lines, 'fixe', 'available') + groupTotal(lines, 'plaisir', 'available');
  const saving = groupTotal(lines, 'epargne', 'actual');
  const plannedSaving = groupTotal(lines, 'epargne', 'available');
  return {
    income,
    plannedIncome,
    spending,
    plannedSpending,
    saving,
    plannedSaving,
    balance: income - spending - saving,
    plannedBalance: plannedIncome - plannedSpending - plannedSaving,
  };
};

export const annualActualInMonth = (
  transactions: Transaction[],
  categories: Category[],
  month: MonthKey,
): Cents => {
  const actuals = categoryActuals(transactions, categories, month);
  return categories
    .filter(isAnnual)
    .reduce((total, category) => total + (actuals[category.id]?.actual ?? 0), 0);
};

const takeWhile = <T>(items: T[], keep: (item: T) => boolean): T[] => {
  const stop = items.findIndex((item) => !keep(item));
  if (stop === -1) {
    return items;
  }
  return items.slice(0, stop);
};

export const propagateBudgetLine = (
  budgets: MonthBudget[],
  month: MonthKey,
  categoryId: string,
  cents: Cents,
): MonthBudget[] => {
  const current = effectiveBudget(budgets, month).budget;
  const previous = current.planned[categoryId];
  const later = budgets
    .filter((budget) => budget.month > month)
    .sort((a, b) => a.month.localeCompare(b.month));
  const followers = takeWhile(later, (budget) => budget.planned[categoryId] === previous);
  return [current, ...followers].map((budget) => ({
    ...budget,
    planned: { ...budget.planned, [categoryId]: cents },
  }));
};

export const plaisirSpent = (transactions: Transaction[], categories: Category[], month: MonthKey): Cents => {
  const actuals = categoryActuals(transactions, categories, month);
  return categories
    .filter((category) => category.group === 'plaisir' && isMonthly(category))
    .reduce((total, category) => total + (actuals[category.id]?.actual ?? 0), 0);
};

export const plaisirAvailable = (lines: BudgetLine[], fallback: Cents): Cents => {
  const available = groupTotal(lines, 'plaisir', 'available');
  if (available > 0) {
    return available;
  }
  return fallback;
};

const comparable = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Catégorie d'épargne d'un virement ou d'un investissement : celle qui porte le nom du
 * compte crédité (« LDDS », « Trade Republic »…), pour que la ligne du budget se remplisse
 * sans choisir de catégorie.
 */
export const savingsCategoryFor = (
  accountId: string | null,
  accountName: (id: string) => string | undefined,
  categories: Category[],
): string | null => {
  const name = accountId ? accountName(accountId) : undefined;
  if (!name) {
    return null;
  }
  return (
    categories.find(
      (category) =>
        category.group === 'epargne' && !category.archived && comparable(category.name) === comparable(name),
    )?.id ?? null
  );
};

/**
 * Catégorie d'épargne qui suit un compte d'épargne : créée avec lui, renommée et archivée avec lui,
 * pour que le budget n'affiche que les comptes réellement suivis. null : rien à changer.
 */
export const savingsCategoryOfAccount = (
  account: Account,
  previous: Account | undefined,
  categories: Category[],
  newId: () => string,
): Category | null => {
  if (account.group === 'courant') {
    return null;
  }
  const named = (name: string) =>
    categories.find(
      (category) => category.group === 'epargne' && comparable(category.name) === comparable(name),
    );
  const existing = named(account.name) ?? (previous ? named(previous.name) : undefined);
  if (!existing) {
    if (account.archived) {
      return null;
    }
    return { id: newId(), name: account.name, group: 'epargne', period: 'mensuel', archived: false };
  }
  if (existing.name === account.name && existing.archived === account.archived) {
    return null;
  }
  return { ...existing, name: account.name, archived: account.archived };
};

/**
 * Compte d'épargne qui suit sa catégorie, dans l'autre sens : archiver, réactiver ou renommer la
 * catégorie depuis Paramètres fait de même pour le compte du même nom. null : rien à changer.
 */
export const savingsAccountOfCategory = (
  category: Category,
  previous: Category | undefined,
  accounts: Account[],
): Account | null => {
  if (category.group !== 'epargne') {
    return null;
  }
  const named = (name: string) =>
    accounts.find((account) => isSavingsAccount(account) && comparable(account.name) === comparable(name));
  const existing = (previous ? named(previous.name) : undefined) ?? named(category.name);
  if (!existing || (existing.name === category.name && existing.archived === category.archived)) {
    return null;
  }
  return { ...existing, name: category.name, archived: category.archived };
};

/**
 * Catégories de dépenses (charges fixes, dépenses personnelles) qui dépassent un budget prévu ce
 * mois-ci. Une catégorie sans budget n'est pas comptée : rien n'a été prévu, rien n'est dépassé.
 */
export const overBudgetLines = (lines: BudgetLine[]): BudgetLine[] =>
  lines.filter(
    (line) =>
      (line.group === 'fixe' || line.group === 'plaisir') && line.available > 0 && line.status === 'depasse',
  );
