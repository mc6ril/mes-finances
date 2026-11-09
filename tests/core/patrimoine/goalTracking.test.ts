import {
  goalHistory,
  goalStartFor,
  goalTracking,
  linkedValueAt,
  plannedAmountAt,
} from '@/core/patrimoine/goalTracking';
import type { Goal } from '@/core/shared/model';
import { aMovement, anAccount, aValuation } from '../fixtures';

const pea = anAccount({
  id: 'pea',
  name: 'PEA',
  kind: 'bourse',
  group: 'investissement',
  openingBalance: 100000,
  openingDate: '2026-01-01',
});

const context = {
  transactions: [],
  movements: [aMovement({ accountId: 'pea', date: '2026-03-01', kind: 'versement', amount: 50000 })],
  valuations: [aValuation({ accountId: 'pea', date: '2026-06-30', value: 170000 })],
};

const goal: Goal = {
  id: 'g1',
  name: 'Long terme',
  targetAmount: 200000,
  targetDate: '2027-01-01',
  initialAmount: 0,
  monthlyContribution: 10000,
  linkedAccountIds: ['pea'],
  startDate: '2026-01-01',
  startAmount: 100000,
};

describe('trajectoire prévue', () => {
  it('va en ligne droite du point de départ à la cible', () => {
    expect(plannedAmountAt(goal, '2026-07-02')).toBe(149863);
  });

  it('vaut le montant de départ avant le départ et la cible après la date', () => {
    expect(plannedAmountAt(goal, '2025-12-01')).toBe(100000);
    expect(plannedAmountAt(goal, '2027-06-01')).toBe(200000);
  });
});

describe('valeur des comptes liés', () => {
  it('additionne la valeur et la performance à une date', () => {
    expect(linkedValueAt(['pea'], [pea], context, '2026-07-02')).toEqual({
      value: 170000,
      contributions: 150000,
      performance: 20000,
    });
  });

  it('applique la part personnelle d’un compte joint', () => {
    const joint = { ...pea, isJoint: true, personalSharePercent: 50 };
    expect(linkedValueAt(['pea'], [joint], context, '2026-07-02').value).toBe(85000);
  });
});

describe('suivi réel', () => {
  it('donne l’écart au plan, les versements et la plus-value depuis le départ', () => {
    expect(goalTracking(goal, [pea], context, '2026-07-02')).toEqual({
      actual: 170000,
      planned: 149863,
      gap: 20137,
      contributed: 50000,
      performance: 20000,
    });
  });

  it('montre une moins-value quand le placement baisse', () => {
    const down = {
      ...context,
      valuations: [aValuation({ accountId: 'pea', date: '2026-06-30', value: 130000 })],
    };
    expect(goalTracking(goal, [pea], down, '2026-07-02')).toMatchObject({
      actual: 130000,
      gap: -19863,
      contributed: 50000,
      performance: -20000,
    });
  });

  it('sans compte lié, compare le montant saisi sans pouvoir isoler la performance', () => {
    const manual = { ...goal, linkedAccountIds: [], initialAmount: 120000 };
    expect(goalTracking(manual, [pea], context, '2026-07-02')).toEqual({
      actual: 120000,
      planned: 149863,
      gap: -29863,
      contributed: null,
      performance: null,
    });
  });
});

describe('historique réel', () => {
  it('donne la valeur en fin de mois depuis le départ, puis aujourd’hui', () => {
    const history = goalHistory(goal, [pea], context, '2026-07-02');
    expect(history.map((point) => point.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
    expect(history[1]?.actual).toBe(100000 + Math.round(((170000 - 150000) * 58) / 180));
    expect(history.at(-1)?.actual).toBe(170000);
  });

  it('est vide sans compte lié', () => {
    expect(goalHistory({ ...goal, linkedAccountIds: [] }, [pea], context, '2026-07-02')).toEqual([]);
  });
});

describe('point de départ d’un objectif existant', () => {
  const legacy = { ...goal, startDate: undefined, startAmount: undefined };

  it('reprend la date de création de l’objectif et la valeur des comptes ce jour-là', () => {
    const audit = [
      {
        id: 'a1',
        at: '2026-07-02T09:00:00.000Z',
        action: 'creation' as const,
        entity: 'Objectif',
        summary: 'Long terme',
      },
    ];
    expect(goalStartFor(legacy, { accounts: [pea], context, audit })).toEqual({
      startDate: '2026-07-02',
      startAmount: 170000,
    });
  });

  it('sans trace de création, part de l’ouverture des comptes liés', () => {
    expect(goalStartFor(legacy, { accounts: [pea], context, audit: [] })).toEqual({
      startDate: '2026-01-01',
      startAmount: 100000,
    });
  });

  it('sans compte lié, part du montant déjà constitué', () => {
    const manual = { ...legacy, linkedAccountIds: [], initialAmount: 30000 };
    expect(goalStartFor(manual, { accounts: [pea], context, audit: [] })).toEqual({
      startDate: '2027-01-01',
      startAmount: 30000,
    });
  });
});

describe('apports prévus hors comptes', () => {
  it('sont totalisés à part, sans changer le montant constitué', async () => {
    const { plannedContributionsOf } = await import('@/core/patrimoine/goalTracking');
    const withPlanned = {
      ...goal,
      plannedContributions: [
        { id: 'p1', label: 'Apport Cyril', amount: 500000 },
        { id: 'p2', label: 'Apport famille', amount: 3000000 },
      ],
    };
    expect(plannedContributionsOf(withPlanned)).toBe(3500000);
    expect(plannedContributionsOf(goal)).toBe(0);
    expect(goalTracking(withPlanned, [pea], context, '2026-07-02').actual).toBe(170000);
  });
});
