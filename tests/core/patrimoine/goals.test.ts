import { goalProgress, projectionScenarios } from '@/core/patrimoine/goals';
import type { Goal } from '@/core/shared/model';

const goal: Goal = {
  id: 'g1',
  name: 'Atteindre 15 000 € d’épargne',
  targetAmount: 1500000,
  targetDate: '2028-12-31',
  initialAmount: 0,
  monthlyContribution: 20000,
  linkedAccountIds: [],
  startDate: '2026-11-05',
  startAmount: 0,
};

describe('goalProgress avec apports prévus', () => {
  it('déduit les apports prévus du reste à constituer et du versement pour tenir la date', () => {
    const withPlanned = {
      ...goal,
      targetDate: '2027-12-31',
      plannedContributions: [{ id: 'p1', label: 'Famille', amount: 500000 }],
    };
    const progress = goalProgress(withPlanned, 228100, '2026-11-05');
    expect(progress.percent).toBe(15.2);
    expect(progress.remaining).toBe(1500000 - 228100 - 500000);
    expect(progress.requiredMonthly).toBe(Math.ceil(771900 / 13));
  });
});

describe('goalProgress', () => {
  it('calcule l’avancement et la date d’atteinte sans rendement', () => {
    const progress = goalProgress(goal, 1228100, '2026-11-05');
    expect(progress).toMatchObject({
      percent: 81.9,
      remaining: 271900,
      monthsToTarget: 14,
      projectedMonth: '2028-01',
      onTrack: true,
    });
  });

  it('donne le versement mensuel nécessaire pour tenir la date', () => {
    const progress = goalProgress({ ...goal, targetDate: '2027-04-30' }, 1228100, '2026-11-05');
    expect(progress.onTrack).toBe(false);
    expect(progress.requiredMonthly).toBe(54380);
  });

  it('considère l’objectif atteint quand le montant cible est constitué', () => {
    expect(goalProgress(goal, 1600000, '2026-11-05')).toMatchObject({
      percent: 100,
      remaining: 0,
      monthsToTarget: 0,
      onTrack: true,
    });
  });

  it('ne projette aucune date sans versement mensuel', () => {
    expect(goalProgress({ ...goal, monthlyContribution: 0 }, 100000, '2026-11-05').projectedMonth).toBeNull();
  });
});

describe('projectionScenarios', () => {
  it('présente plusieurs hypothèses de rendement, la prudente sans rendement', () => {
    const scenarios = projectionScenarios({
      current: 0,
      monthly: 10000,
      target: 120000,
      annualRates: [0, 0.03],
      fromMonth: '2026-11',
    });
    expect(scenarios[0]).toMatchObject({ annualRate: 0, monthsToTarget: 12, reachedMonth: '2027-11' });
    expect(scenarios[1]?.monthsToTarget).toBeLessThanOrEqual(12);
    expect(scenarios.every((scenario) => scenario.isHypothesis)).toBe(true);
  });

  it('borne la projection à 50 ans', () => {
    const scenarios = projectionScenarios({
      current: 0,
      monthly: 1,
      target: 100000000,
      annualRates: [0],
      fromMonth: '2026-11',
    });
    expect(scenarios[0]?.monthsToTarget).toBeNull();
  });

  it('fournit une série de valeurs projetées pour le graphique', () => {
    const scenarios = projectionScenarios({
      current: 10000,
      monthly: 10000,
      target: 50000,
      annualRates: [0],
      fromMonth: '2026-11',
    });
    expect(scenarios[0]?.series.slice(0, 3)).toEqual([10000, 20000, 30000]);
  });
});
