import { useMemo } from 'react';
import { accountBalanceAt } from '@/core/balances';
import {
  budgetLines,
  monthTotals,
  plaisirAvailable,
  plaisirBudgetOf,
  plaisirSpent,
  type BudgetLine,
  effectiveBudget,
  effectiveYearBudget,
} from '@/core/budget';
import { addMonths, monthEnd, monthKeyOf } from '@/core/dates';
import { patrimoineAt, type PatrimoineContext } from '@/core/patrimoine';
import type { CategoryGroup, Dataset, IsoDate, MonthBudget, MonthKey, YearBudget } from '@/core/model';

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

export const visibleGroups = (dataset: Dataset): CategoryGroup[] => {
  if (dataset.settings.mode === 'simple') {
    return ['epargne', 'plaisir'];
  }
  return ['revenu', 'fixe', 'epargne', 'plaisir'];
};

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

export const useMonthOverview = (dataset: Dataset, month: MonthKey, today: IsoDate) =>
  useMemo(() => {
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
  }, [dataset, month, today]);
