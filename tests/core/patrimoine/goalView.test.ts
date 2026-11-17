import {
  GOAL_RATE_HYPOTHESES,
  goalProgress,
  isOnPlan,
  MAX_PROJECTION_YEARS,
  progressWithPlanned,
  savingsTarget,
  scenarioRates,
  showsProjections,
} from '@/core/patrimoine/goals';
import type { Goal } from '@/core/shared/model';

const goal: Goal = {
  id: 'g1',
  name: 'Apport',
  targetAmount: 1000000,
  targetDate: '2028-12-31',
  initialAmount: 0,
  monthlyContribution: 20000,
  linkedAccountIds: [],
  startDate: '2026-01-01',
  startAmount: 0,
};

describe('règles d’affichage d’un objectif', () => {
  it('est dans la trajectoire tant que l’écart reste sous 1 % de la cible', () => {
    expect(isOnPlan(9999, goal)).toBe(true);
    expect(isOnPlan(-9999, goal)).toBe(true);
    expect(isOnPlan(10000, goal)).toBe(false);
    expect(isOnPlan(-10000, goal)).toBe(false);
  });

  it('déduit les apports prévus de ce qu’il faut réunir sur les comptes, sans descendre sous zéro', () => {
    expect(savingsTarget(goal)).toBe(1000000);
    const planned = (amount: number): Goal => ({
      ...goal,
      plannedContributions: [{ id: 'p1', label: 'Famille', amount }],
    });
    expect(savingsTarget(planned(300000))).toBe(700000);
    expect(savingsTarget(planned(2000000))).toBe(0);
  });

  it('retient les hypothèses de rendement, ou aucune pour une épargne sans rendement', () => {
    expect(scenarioRates(goal)).toEqual(GOAL_RATE_HYPOTHESES);
    expect(scenarioRates({ ...goal, withReturns: true })).toEqual(GOAL_RATE_HYPOTHESES);
    expect(scenarioRates({ ...goal, withReturns: false })).toEqual([0]);
  });

  it('montre les projections s’il y a un versement mensuel et un reste à constituer', () => {
    const progressOf = (current: number) => goalProgress(goal, current, '2026-11-17');
    expect(showsProjections(goal, progressOf(100000))).toBe(true);
    expect(showsProjections(goal, progressOf(1000000))).toBe(false);
    expect(showsProjections({ ...goal, monthlyContribution: 0 }, progressOf(100000))).toBe(false);
  });

  it('calcule l’avancement en comptant les apports prévus, au dixième et plafonné à 100 %', () => {
    expect(progressWithPlanned(goal, 123400, 100000)).toEqual({ amount: 223400, percent: 22.3 });
    expect(progressWithPlanned(goal, 900000, 500000)).toEqual({ amount: 1400000, percent: 100 });
  });

  it('exprime l’horizon de projection en années', () => {
    expect(MAX_PROJECTION_YEARS).toBe(50);
  });
});
