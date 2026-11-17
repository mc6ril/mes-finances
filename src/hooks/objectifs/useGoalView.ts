import { useMemo } from 'react';
import { patrimoineContext } from '@/core/budget/overview';
import { goalChartRows } from '@/core/patrimoine/goalChart';
import {
  goalProgress,
  progressWithPlanned,
  projectionScenarios,
  savingsTarget,
  scenarioRates,
  showsProjections,
} from '@/core/patrimoine/goals';
import { goalHistory, goalTracking, plannedContributionsOf } from '@/core/patrimoine/goalTracking';
import { monthKeyOf } from '@/core/shared/dates';
import type { Goal } from '@/core/shared/model';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';

/** Suivi d'un objectif : constitué, écart au plan, avancement, projections et lignes du graphique. */
export const useGoalView = (goal: Goal) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const tracking = useMemo(
    () => goalTracking(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const history = useMemo(
    () => goalHistory(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const current = tracking.actual;
  const plannedTotal = plannedContributionsOf(goal);
  const progress = goalProgress(goal, current, today);
  const month = monthKeyOf(today);
  const target = savingsTarget(goal);
  const rates = scenarioRates(goal);
  const scenarios = useMemo(
    () =>
      projectionScenarios({
        current,
        monthly: goal.monthlyContribution,
        target,
        annualRates: rates,
        fromMonth: month,
      }),
    [current, goal.monthlyContribution, target, rates, month],
  );
  const showProjections = showsProjections(goal, progress);
  const chart = useMemo(
    () => goalChartRows({ goal, history, month, scenarios, showProjections }),
    [goal, history, month, scenarios, showProjections],
  );
  return {
    tracking,
    history,
    current,
    plannedTotal,
    withPlanned: progressWithPlanned(goal, current, plannedTotal),
    progress,
    savingsTarget: target,
    scenarios,
    showProjections,
    chart,
  };
};
