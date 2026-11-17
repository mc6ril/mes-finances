import { goalChartRows, projectionHorizon } from '@/core/patrimoine/goalChart';
import { plannedAmountAt } from '@/core/patrimoine/goalTracking';
import type { ProjectionScenario } from '@/core/patrimoine/goals';
import type { Goal } from '@/core/shared/model';

const goal: Goal = {
  id: 'g1',
  name: 'Apport',
  targetAmount: 1000000,
  targetDate: '2027-03-31',
  initialAmount: 0,
  monthlyContribution: 20000,
  linkedAccountIds: [],
  startDate: '2026-09-15',
  startAmount: 100000,
};

const scenario = (
  annualRate: number,
  monthsToTarget: number | null,
  series: number[],
): ProjectionScenario => ({
  annualRate,
  monthsToTarget,
  reachedMonth: null,
  series,
  isHypothesis: true,
});

describe('horizon de projection', () => {
  it('va jusqu’à l’atteinte du premier scénario plus 6 mois, entre 12 et 120 mois', () => {
    expect(projectionHorizon([scenario(0, 30, [])])).toBe(36);
    expect(projectionHorizon([scenario(0, 2, [])])).toBe(12);
    expect(projectionHorizon([scenario(0, 500, [])])).toBe(120);
    expect(projectionHorizon([scenario(0, null, [])])).toBe(66);
    expect(projectionHorizon([])).toBe(66);
  });
});

describe('lignes du graphique d’un objectif', () => {
  const history = [
    { month: '2026-09', actual: 100000 },
    { month: '2026-10', actual: 130000 },
  ];

  it('va du départ à la date cible sans projection, avec le réel et la trajectoire prévue', () => {
    const rows = goalChartRows({
      goal,
      history,
      month: '2026-11',
      scenarios: [scenario(0, 30, [150000, 170000])],
      showProjections: false,
    });
    expect(rows.map((row) => row.month)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ]);
    expect(rows[0]).toEqual({
      month: '2026-09',
      actual: 100000,
      plan: plannedAmountAt(goal, '2026-09-15'),
      r0: null,
    });
    expect(rows[1]?.plan).toBe(plannedAmountAt(goal, '2026-10-31'));
    expect(rows[2]).toMatchObject({ actual: null, r0: null });
  });

  it('prolonge jusqu’à l’horizon de projection et décale les scénarios à partir du mois courant', () => {
    const rows = goalChartRows({
      goal,
      history,
      month: '2026-11',
      scenarios: [scenario(0, 6, [150000, 170000, 190000]), scenario(0.04, 5, [150000, 171000])],
      showProjections: true,
    });
    expect(rows.at(-1)?.month).toBe('2027-11');
    expect(rows[1]).toMatchObject({ month: '2026-10', r0: null, 'r0.04': null });
    expect(rows[2]).toMatchObject({ month: '2026-11', r0: 150000, 'r0.04': 150000 });
    expect(rows[3]).toMatchObject({ month: '2026-12', r0: 170000, 'r0.04': 171000 });
    expect(rows[5]).toMatchObject({ month: '2027-02', r0: null, 'r0.04': null });
  });

  it('n’affiche plus de trajectoire prévue après le mois cible', () => {
    const rows = goalChartRows({
      goal,
      history,
      month: '2026-11',
      scenarios: [scenario(0, 6, [])],
      showProjections: true,
    });
    expect(rows.find((row) => row.month === '2027-03')?.plan).toBe(plannedAmountAt(goal, '2027-03-31'));
    expect(rows.find((row) => row.month === '2027-04')?.plan).toBeNull();
  });

  it('commence au mois courant quand le départ est dans le futur', () => {
    const rows = goalChartRows({
      goal: { ...goal, startDate: '2027-01-10' },
      history: [],
      month: '2026-11',
      scenarios: [],
      showProjections: false,
    });
    expect(rows[0]?.month).toBe('2026-11');
  });
});
