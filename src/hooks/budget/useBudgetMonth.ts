import { useMemo } from 'react';
import { annualActualInMonth, monthBudgetSummary, provisionPerMonth } from '@/core/budget/budget';
import { budgetGroupsFor, budgetOf, budgetOriginOf, linesFor, yearBudgetOf } from '@/core/budget/overview';
import { budgetPrefill, isBudgetEmpty } from '@/core/budget/prefill';
import { commonBudgetPlan } from '@/core/commun/commonMonth';
import { commonMonthSummary } from '@/core/commun/household';
import type { MonthKey } from '@/core/shared/model';
import { useDataset } from '@/hooks/useFinance';

/** Budget du mois affiché : lignes, résumé (perso) ou répartition (commun), budget et son origine, pré-remplissage, provision et groupes à saisir. */
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
  const isCommon = kind === 'commun';
  // Commun : la répartition du budget ; perso : le résumé du mois, réel face au prévu.
  const plan = useMemo(
    () => (isCommon ? commonBudgetPlan(commonMonthSummary(dataset, month), lines, provision) : null),
    [isCommon, dataset, month, lines, provision],
  );
  const summary = useMemo(
    () => (isCommon ? null : monthBudgetSummary(lines, provision, annualSpent)),
    [isCommon, lines, provision, annualSpent],
  );
  return {
    kind,
    isCommon,
    lines,
    summary,
    plan,
    budget,
    origin,
    prefill,
    provision,
    annualSpent,
    groups: budgetGroupsFor(kind),
  };
};
