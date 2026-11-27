import { useMemo } from 'react';
import { patrimoineContext } from '@/core/budget/overview';
import { projectionScenarios } from '@/core/patrimoine/goals';
import { linkedValueAt } from '@/core/patrimoine/goalTracking';
import {
  depositMonths,
  fiveYearMark,
  hasTarget,
  horizonRange,
  marketDip,
  REGULAR_RATE_HYPOTHESES,
  regularChartRows,
  regularity,
} from '@/core/patrimoine/regularInvesting';
import { monthKeyOf, monthsBetween } from '@/core/shared/dates';
import type { Goal } from '@/core/shared/model';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';

/** Suivi d'un investissement régulier : régularité, valeur, baisse du marché, fourchette et graphique. */
export const useRegularGoalView = (goal: Goal) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const months = useMemo(
    () => depositMonths(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const now = useMemo(
    () => linkedValueAt(goal.linkedAccountIds, dataset.accounts, context, today),
    [goal.linkedAccountIds, dataset.accounts, context, today],
  );
  const month = monthKeyOf(today);
  const monthsLeft = Math.max(0, monthsBetween(month, monthKeyOf(goal.targetDate)));
  const scenarios = useMemo(
    () =>
      projectionScenarios({
        current: now.value,
        monthly: goal.monthlyContribution,
        target: goal.targetAmount,
        annualRates: REGULAR_RATE_HYPOTHESES,
        fromMonth: month,
      }),
    [now.value, goal.monthlyContribution, goal.targetAmount, month],
  );
  const chart = useMemo(
    () => regularChartRows({ goal, months, month, current: now.value, annualRates: REGULAR_RATE_HYPOTHESES }),
    [goal, months, month, now.value],
  );
  const mark = fiveYearMark(goal, dataset.accounts);
  return {
    value: now.value,
    invested: now.contributions,
    performance: now.performance,
    regularity: regularity(months, goal.monthlyContribution),
    dip: marketDip(months),
    horizon: horizonRange({
      current: now.value,
      invested: now.contributions,
      monthly: goal.monthlyContribution,
      months: monthsLeft,
      annualRates: REGULAR_RATE_HYPOTHESES,
    }),
    withTarget: hasTarget(goal),
    scenarios,
    chart,
    /** Repère des 5 ans, seulement s'il tombe dans le graphique. */
    fiveYearMark: mark && chart.some((row) => row.month === mark) ? mark : null,
  };
};
