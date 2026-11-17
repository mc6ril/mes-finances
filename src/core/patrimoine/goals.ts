import { addMonths, monthKeyOf, monthsBetween } from '../shared/dates';
import type { Cents, Goal, IsoDate, MonthKey } from '../shared/model';
import { plannedContributionsOf } from './goalTracking';

export type GoalProgress = {
  percent: number;
  remaining: Cents;
  monthsToTarget: number | null;
  projectedMonth: MonthKey | null;
  onTrack: boolean;
  requiredMonthly: Cents;
  monthsLeft: number;
};

const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const goalProgress = (goal: Goal, current: Cents, today: IsoDate): GoalProgress => {
  const currentMonth = monthKeyOf(today);
  const targetMonth = monthKeyOf(goal.targetDate);
  // Les apports prévus hors comptes réduisent ce qu'il reste à épargner, sans compter comme constitués.
  const planned = (goal.plannedContributions ?? []).reduce((total, line) => total + line.amount, 0);
  const remaining = Math.max(0, goal.targetAmount - current - planned);
  const monthsLeft = Math.max(0, monthsBetween(currentMonth, targetMonth));
  if (remaining === 0) {
    return {
      percent: Math.min(100, roundOneDecimal((current / goal.targetAmount) * 100)),
      remaining: 0,
      monthsToTarget: 0,
      projectedMonth: currentMonth,
      onTrack: true,
      requiredMonthly: 0,
      monthsLeft,
    };
  }
  const monthsToTarget = monthsNeeded(remaining, goal.monthlyContribution);
  const projectedMonth = projectedFrom(currentMonth, monthsToTarget);
  return {
    percent: Math.min(100, roundOneDecimal((current / goal.targetAmount) * 100)),
    remaining,
    monthsToTarget,
    projectedMonth,
    onTrack: projectedMonth !== null && projectedMonth <= targetMonth,
    requiredMonthly: requiredFor(remaining, monthsLeft),
    monthsLeft,
  };
};

const monthsNeeded = (remaining: Cents, monthly: Cents): number | null => {
  if (monthly <= 0) {
    return null;
  }
  return Math.ceil(remaining / monthly);
};

const projectedFrom = (month: MonthKey, months: number | null): MonthKey | null => {
  if (months === null) {
    return null;
  }
  return addMonths(month, months);
};

const requiredFor = (remaining: Cents, monthsLeft: number): Cents => {
  if (monthsLeft === 0) {
    return remaining;
  }
  return Math.ceil(remaining / monthsLeft);
};

export type ProjectionScenario = {
  annualRate: number;
  monthsToTarget: number | null;
  reachedMonth: MonthKey | null;
  series: Cents[];
  isHypothesis: true;
};

type ScenarioInput = {
  current: Cents;
  monthly: Cents;
  target: Cents;
  annualRates: number[];
  fromMonth: MonthKey;
};

export const MAX_PROJECTION_MONTHS = 600;
const SERIES_MONTHS = 120;

const monthlyRateOf = (annualRate: number): number => (1 + annualRate) ** (1 / 12) - 1;

export const projectionScenarios = ({
  current,
  monthly,
  target,
  annualRates,
  fromMonth,
}: ScenarioInput): ProjectionScenario[] =>
  annualRates.map((annualRate) => {
    const rate = monthlyRateOf(annualRate);
    const series: Cents[] = [current];
    let value = current;
    let monthsToTarget: number | null = value >= target ? 0 : null;
    for (let month = 1; month <= MAX_PROJECTION_MONTHS; month += 1) {
      value = Math.round(value * (1 + rate)) + monthly;
      if (month <= SERIES_MONTHS) {
        series.push(value);
      }
      if (monthsToTarget === null && value >= target) {
        monthsToTarget = month;
      }
      if (monthsToTarget !== null && month >= SERIES_MONTHS) {
        break;
      }
    }
    return {
      annualRate,
      monthsToTarget,
      reachedMonth: projectedFrom(fromMonth, monthsToTarget),
      series,
      isHypothesis: true,
    };
  });

export const GOAL_RATE_HYPOTHESES = [0, 0.02, 0.04];

/** Horizon au-delà duquel une projection est déclarée hors d'atteinte, en années. */
export const MAX_PROJECTION_YEARS = MAX_PROJECTION_MONTHS / 12;

/** Sans rendement : une seule projection, au versement mensuel prévu. */
const NO_RETURNS = [0];

/** Hypothèses de rendement retenues pour un objectif. */
export const scenarioRates = (goal: Goal): number[] =>
  goal.withReturns === false ? NO_RETURNS : GOAL_RATE_HYPOTHESES;

/** En dessous de 1 % de la cible, l'écart avec la trajectoire prévue n'est pas significatif. */
export const isOnPlan = (gap: Cents, goal: Goal): boolean => Math.abs(gap) < goal.targetAmount / 100;

/** Ce qu'il faut réunir sur les comptes : la cible moins les apports prévus hors comptes. */
export const savingsTarget = (goal: Goal): Cents =>
  Math.max(0, goal.targetAmount - plannedContributionsOf(goal));

/** Les projections n'ont de sens qu'avec un versement mensuel et un reste à constituer. */
export const showsProjections = (goal: Goal, progress: GoalProgress): boolean =>
  goal.monthlyContribution > 0 && progress.remaining > 0;

/** Avancement en comptant les apports prévus (prévisionnel), au dixième et plafonné à 100 %. */
export const progressWithPlanned = (
  goal: Goal,
  current: Cents,
  plannedTotal: Cents,
): { amount: Cents; percent: number } => {
  const amount = current + plannedTotal;
  return { amount, percent: Math.min(100, roundOneDecimal((amount / goal.targetAmount) * 100)) };
};
