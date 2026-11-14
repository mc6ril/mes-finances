import { accountBalanceAt } from '@/core/comptes/balances';
import {
  budgetLines,
  categoryActuals,
  monthTotals,
  plaisirAvailable,
  plaisirBudgetOf,
  plaisirSpent,
  type BudgetLine,
  effectiveBudget,
  effectiveYearBudget,
} from '@/core/budget/budget';
import { addMonths, monthEnd, monthKeyOf } from '@/core/shared/dates';
import { patrimoineAt, type PatrimoineContext } from '@/core/patrimoine/patrimoine';
import type { CategoryGroup, Dataset, IsoDate, MonthBudget, MonthKey, YearBudget } from '@/core/shared/model';

export const budgetOf = (dataset: Dataset, month: MonthKey): MonthBudget | null => {
  const { budget, inheritedFrom } = effectiveBudget(dataset.budgets, month);
  const isDefined = inheritedFrom !== null || dataset.budgets.some((entry) => entry.month === month);
  if (!isDefined) {
    return null;
  }
  return budget;
};

export const budgetOriginOf = (dataset: Dataset, month: MonthKey): MonthKey | null =>
  effectiveBudget(dataset.budgets, month).inheritedFrom;

export const yearBudgetOf = (dataset: Dataset, year: string): YearBudget | null =>
  effectiveYearBudget(dataset.yearBudgets, year).budget;

export const yearBudgetOriginOf = (dataset: Dataset, year: string): string | null =>
  effectiveYearBudget(dataset.yearBudgets, year).inheritedFrom;

export const emptyBudget = (month: MonthKey): MonthBudget => ({ month, planned: {}, carryOver: false });

export const patrimoineContext = (dataset: Dataset): PatrimoineContext => ({
  transactions: dataset.transactions,
  movements: dataset.savingsMovements,
  valuations: dataset.valuations,
});

export const BUDGET_GROUPS: CategoryGroup[] = ['revenu', 'fixe', 'epargne', 'plaisir'];

export const referenceDate = (month: MonthKey, today: IsoDate): IsoDate => {
  if (monthKeyOf(today) === month) {
    return today;
  }
  if (month < monthKeyOf(today)) {
    return monthEnd(month);
  }
  return today;
};

export const linesFor = (dataset: Dataset, month: MonthKey): BudgetLine[] => {
  const budget = budgetOf(dataset, month) ?? emptyBudget(month);
  const previousBudget = budgetOf(dataset, addMonths(month, -1));
  return budgetLines({
    budget,
    previousBudget,
    categories: dataset.categories,
    transactions: dataset.transactions,
  });
};

export const plaisirBudgetFor = (dataset: Dataset, month: MonthKey): number => {
  const lines = linesFor(dataset, month);
  return plaisirAvailable(
    lines,
    plaisirBudgetOf(budgetOf(dataset, month), dataset.categories, dataset.settings.plaisirBudget),
  );
};

export const monthOverview = (dataset: Dataset, month: MonthKey, today: IsoDate) => {
  const budget = budgetOf(dataset, month);
  const lines = linesFor(dataset, month);
  const totals = monthTotals(dataset.transactions, dataset.categories, month);
  const plaisirBudget = plaisirBudgetFor(dataset, month);
  const spent = plaisirSpent(dataset.transactions, dataset.categories, month);
  const date = referenceDate(month, today);
  const mainAccount =
    dataset.accounts.find((account) => account.id === dataset.settings.mainAccountId) ?? null;
  const balance = mainAccount ? accountBalanceAt(mainAccount, dataset.transactions, date) : 0;
  const projectedBalance = mainAccount
    ? accountBalanceAt(mainAccount, dataset.transactions, monthEnd(month), { includePlanned: true })
    : 0;
  const context = patrimoineContext(dataset);
  const patrimoine = patrimoineAt(dataset.accounts, context, date);
  const previousPatrimoine = patrimoineAt(dataset.accounts, context, monthEnd(addMonths(month, -1)));
  return {
    budget,
    lines,
    totals,
    plaisirBudget,
    spent,
    date,
    mainAccount,
    balance,
    projectedBalance,
    patrimoine,
    previousPatrimoine,
  };
};

const MAX_SLICES = 5;

export type SpendingSlice = { id: string; name: string; value: number };

export const spendingSlices = (dataset: Dataset, month: MonthKey): SpendingSlice[] => {
  const actuals = categoryActuals(dataset.transactions, dataset.categories, month);
  const entries = dataset.categories
    .filter((category) => category.group === 'fixe' || category.group === 'plaisir')
    .map((category) => ({ id: category.id, name: category.name, value: actuals[category.id]?.actual ?? 0 }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const head = entries.slice(0, MAX_SLICES);
  const rest = entries.slice(MAX_SLICES).reduce((total, entry) => total + entry.value, 0);
  if (rest > 0) {
    head.push({ id: 'autres', name: 'Autres catégories', value: rest });
  }
  return head;
};

export type MonthOverview = ReturnType<typeof monthOverview>;

/** Ce que l'espace contient déjà : le tableau de bord n'affiche que ce qui a été saisi. */
export const dashboardContent = (dataset: Dataset) => {
  const groups = new Map(dataset.categories.map((category) => [category.id, category.group]));
  const expenses = dataset.transactions.filter((transaction) => transaction.type === 'depense');
  const savingsAccounts = dataset.accounts.filter(
    (account) => account.group !== 'courant' && !account.archived,
  );
  const hasAmount = (planned: Record<string, number>) => Object.values(planned).some((value) => value !== 0);
  return {
    isEmpty:
      dataset.transactions.length === 0 &&
      dataset.savingsMovements.length === 0 &&
      dataset.valuations.length === 0,
    hasOpeningBalance: dataset.accounts.some(
      (account) => account.id === dataset.settings.mainAccountId && account.openingBalance !== 0,
    ),
    hasIncome: dataset.transactions.some((transaction) => transaction.type === 'revenu'),
    hasFixedCharges: expenses.some((transaction) => groups.get(transaction.categoryId ?? '') === 'fixe'),
    hasPersonalSpending: expenses.some((transaction) => groups.get(transaction.categoryId ?? '') !== 'fixe'),
    hasSavingsAccounts: savingsAccounts.length > 0,
    hasJointAccount: savingsAccounts.some((account) => account.isJoint),
    hasBudget:
      dataset.budgets.some((budget) => hasAmount(budget.planned)) ||
      dataset.yearBudgets.some((budget) => hasAmount(budget.planned)),
  };
};

export type DashboardContent = ReturnType<typeof dashboardContent>;
