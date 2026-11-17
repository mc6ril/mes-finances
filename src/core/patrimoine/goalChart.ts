import { addMonths, monthEnd, monthKeyOf, monthsBetween } from '../shared/dates';
import type { Goal, MonthKey } from '../shared/model';
import { plannedAmountAt, type GoalHistoryPoint } from './goalTracking';
import type { ProjectionScenario } from './goals';

/** Une ligne par mois : réel, trajectoire prévue et une colonne `r<taux>` par scénario. */
export type GoalChartRow = { month: MonthKey } & Record<string, number | null | string>;

const MIN_HORIZON_MONTHS = 12;
const MAX_HORIZON_MONTHS = 120;
/** Sans date d'atteinte connue, on projette sur 5 ans. */
const DEFAULT_MONTHS_TO_TARGET = 60;
/** Marge après l'atteinte, pour voir la courbe dépasser la cible. */
const HORIZON_MARGIN_MONTHS = 6;

/** Nombre de mois projetés : jusqu'à l'atteinte du premier scénario, plus une marge, entre 1 et 10 ans. */
export const projectionHorizon = (scenarios: ProjectionScenario[]): number =>
  Math.min(
    MAX_HORIZON_MONTHS,
    Math.max(
      MIN_HORIZON_MONTHS,
      (scenarios[0]?.monthsToTarget ?? DEFAULT_MONTHS_TO_TARGET) + HORIZON_MARGIN_MONTHS,
    ),
  );

export const scenarioKey = (scenario: ProjectionScenario): string => `r${scenario.annualRate}`;

type GoalChartInput = {
  goal: Goal;
  history: GoalHistoryPoint[];
  /** Mois courant : les scénarios partent de lui. */
  month: MonthKey;
  scenarios: ProjectionScenario[];
  showProjections: boolean;
};

/**
 * Lignes du graphique d'un objectif, du départ (ou du mois courant s'il est antérieur) jusqu'au plus
 * tard du mois cible et de l'horizon de projection.
 */
export const goalChartRows = ({
  goal,
  history,
  month,
  scenarios,
  showProjections,
}: GoalChartInput): GoalChartRow[] => {
  const goalStartMonth = monthKeyOf(goal.startDate);
  const firstMonth = goalStartMonth < month ? goalStartMonth : month;
  const targetMonth = monthKeyOf(goal.targetDate);
  const projectedEnd = showProjections ? addMonths(month, projectionHorizon(scenarios)) : month;
  const lastMonth = [targetMonth, projectedEnd].sort().at(-1) ?? month;
  const actualByMonth = new Map(history.map((point) => [point.month, point.actual]));
  return Array.from({ length: monthsBetween(firstMonth, lastMonth) + 1 }, (_, index): GoalChartRow => {
    const key = addMonths(firstMonth, index);
    const fromNow = monthsBetween(month, key);
    return {
      month: key,
      actual: actualByMonth.get(key) ?? null,
      plan:
        key <= targetMonth
          ? plannedAmountAt(goal, key === goalStartMonth ? goal.startDate : monthEnd(key))
          : null,
      ...Object.fromEntries(
        scenarios.map((scenario) => [
          scenarioKey(scenario),
          showProjections && fromNow >= 0 ? (scenario.series[fromNow] ?? null) : null,
        ]),
      ),
    };
  });
};
