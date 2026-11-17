import { useMemo } from 'react';
import { useDataset } from '@/hooks/useFinance';
import { budgetGroupsFor, budgetOf, budgetOriginOf, linesFor, yearBudgetOf } from '@/core/budget/overview';
import { annualActualInMonth, provisionPerMonth } from '@/core/budget/budget';
import { budgetPrefill, isBudgetEmpty } from '@/core/budget/prefill';
import type { MonthKey } from '@/core/shared/model';

/** Budget du mois affiché : lignes, budget et son origine, pré-remplissage, provision et groupes à saisir. */
export const useBudgetMonth = (month: MonthKey) => {
  const dataset = useDataset();
  const { kind } = dataset.settings;
  const lines = useMemo(() => linesFor(dataset, month), [dataset, month]);
  const budget = useMemo(() => budgetOf(dataset, month), [dataset, month]);
  const origin = useMemo(() => budgetOriginOf(dataset, month), [dataset, month]);
  const prefill = useMemo(
    () => (isBudgetEmpty(budget) ? budgetPrefill(dataset, month) : null),
    [budget, dataset, month],
  );
  const provision = useMemo(
    () => provisionPerMonth(yearBudgetOf(dataset, month.slice(0, 4)), dataset.categories),
    [dataset, month],
  );
  const annualSpent = useMemo(
    () => annualActualInMonth(dataset.transactions, dataset.categories, month),
    [dataset.transactions, dataset.categories, month],
  );
  return {
    kind,
    isCommon: kind === 'commun',
    lines,
    budget,
    origin,
    prefill,
    provision,
    annualSpent,
    groups: budgetGroupsFor(kind),
  };
};
