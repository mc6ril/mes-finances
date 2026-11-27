import {
  type DepositMonth,
  depositMonths,
  fiveYearMark,
  horizonRange,
  marketDip,
  regularChartRows,
  regularity,
} from '@/core/patrimoine/regularInvesting';
import type { Goal } from '@/core/shared/model';
import { aMovement, anAccount, aValuation } from '../fixtures';

const pea = anAccount({
  id: 'pea',
  name: 'PEA',
  kind: 'bourse',
  group: 'investissement',
  openingBalance: 100000,
  openingDate: '2025-01-10',
});

const goal: Goal = {
  id: 'g1',
  name: 'PEA long terme',
  kind: 'investissement-regulier',
  targetAmount: 0,
  targetDate: '2035-12-31',
  initialAmount: 0,
  monthlyContribution: 20000,
  linkedAccountIds: ['pea'],
  startDate: '2026-01-01',
  startAmount: 100000,
};

const deposit = (date: string, amount = 20000) =>
  aMovement({ accountId: 'pea', date, kind: 'versement', amount });

const month = (overrides: Partial<DepositMonth>): DepositMonth => ({
  month: '2026-01',
  deposited: 20000,
  contributed: 0,
  invested: 0,
  value: 0,
  ...overrides,
});

describe('versements mois par mois', () => {
  it('donne le versé du mois, le cumul depuis le départ, le total investi et la valeur', () => {
    const context = {
      transactions: [],
      movements: [deposit('2025-12-05'), deposit('2026-01-05'), deposit('2026-03-05', 10000)],
      valuations: [aValuation({ accountId: 'pea', date: '2026-02-28', value: 150000 })],
    };
    const months = depositMonths(goal, [pea], context, '2026-03-15');
    expect(
      months.map(({ month, deposited, contributed, invested }) => [month, deposited, contributed, invested]),
    ).toEqual([
      ['2026-01', 20000, 20000, 140000],
      ['2026-02', 0, 20000, 140000],
      ['2026-03', 10000, 30000, 150000],
    ]);
    expect(months[1]?.value).toBe(150000);
  });

  it('est vide sans compte lié ou avant le départ', () => {
    const context = { transactions: [], movements: [], valuations: [] };
    expect(depositMonths({ ...goal, linkedAccountIds: [] }, [pea], context, '2026-03-15')).toEqual([]);
    expect(depositMonths(goal, [pea], context, '2025-12-15')).toEqual([]);
  });
});

describe('régularité des versements', () => {
  it('compte les mois versés d’affilée et le versé attendu', () => {
    const result = regularity(
      [
        month({ month: '2026-01' }),
        month({ month: '2026-02' }),
        month({ month: '2026-03', contributed: 60000 }),
      ],
      20000,
    );
    expect(result).toEqual({
      paidThisMonth: true,
      streak: 3,
      missedMonths: [],
      expected: 60000,
      contributed: 60000,
      gap: 0,
    });
  });

  it('n’attend pas encore le versement du mois en cours', () => {
    const result = regularity(
      [month({ month: '2026-01' }), month({ month: '2026-02', deposited: 0, contributed: 20000 })],
      20000,
    );
    expect(result).toMatchObject({
      paidThisMonth: false,
      streak: 1,
      missedMonths: [],
      expected: 20000,
      gap: 0,
    });
  });

  it('compte un mois passé sans versement complet comme manqué et repart de zéro', () => {
    const result = regularity(
      [
        month({ month: '2026-01' }),
        month({ month: '2026-02', deposited: 5000 }),
        month({ month: '2026-03', contributed: 45000 }),
      ],
      20000,
    );
    expect(result).toMatchObject({ streak: 1, missedMonths: ['2026-02'], expected: 60000, gap: -15000 });
  });

  it('n’exige rien du mois de départ, souvent entamé', () => {
    const result = regularity(
      [month({ month: '2026-01', deposited: 0 }), month({ month: '2026-02', contributed: 20000 })],
      20000,
    );
    expect(result).toMatchObject({ streak: 1, missedMonths: [], expected: 20000 });
  });

  it('vaut zéro sans mois suivi', () => {
    expect(regularity([], 20000)).toEqual({
      paidThisMonth: false,
      streak: 0,
      missedMonths: [],
      expected: 0,
      contributed: 0,
      gap: 0,
    });
  });
});

describe('baisse du marché', () => {
  it('mesure la baisse depuis le plus haut, hors versements, et les versements faits depuis', () => {
    const dip = marketDip([
      month({ month: '2026-01', invested: 100000, value: 110000 }),
      month({ month: '2026-02', invested: 120000, value: 132000 }),
      month({ month: '2026-03', invested: 140000, value: 126000 }),
      month({ month: '2026-04', invested: 160000, value: 136000 }),
    ]);
    expect(dip).toEqual({ drawdown: -0.2273, peakMonth: '2026-01', depositsSincePeak: 3 });
  });

  it('ne signale rien sous 5 % de baisse', () => {
    expect(
      marketDip([
        month({ invested: 100000, value: 110000 }),
        month({ month: '2026-02', invested: 120000, value: 128000 }),
      ]),
    ).toBeNull();
  });

  it('ne signale rien sans montant investi', () => {
    expect(marketDip([month({ invested: 0, value: 0 })])).toBeNull();
  });
});

describe('fourchette à l’horizon', () => {
  it('projette la valeur par hypothèse et le versé total', () => {
    const range = horizonRange({
      current: 100000,
      invested: 100000,
      monthly: 10000,
      months: 12,
      annualRates: [0, 0.06],
    });
    expect(range.invested).toBe(220000);
    expect(range.values[0]).toEqual({ annualRate: 0, value: 220000 });
    expect(range.values[1]?.value).toBeGreaterThan(228000);
    expect(range.values[1]?.value).toBeLessThan(230000);
  });
});

describe('repère des 5 ans', () => {
  it('part de l’ouverture du plus ancien compte bourse lié', () => {
    expect(fiveYearMark(goal, [pea])).toBe('2030-01');
  });

  it('n’existe pas sans compte bourse lié', () => {
    expect(fiveYearMark(goal, [{ ...pea, kind: 'livret' }])).toBeNull();
  });
});

describe('graphique d’un investissement régulier', () => {
  it('montre le réel, le versé, puis les projections jusqu’à l’horizon', () => {
    const rows = regularChartRows({
      goal: { ...goal, targetDate: '2026-05-31' },
      months: [
        month({ month: '2026-02', invested: 120000, value: 125000 }),
        month({ month: '2026-03', invested: 140000, value: 150000 }),
      ],
      month: '2026-03',
      current: 150000,
      annualRates: [0],
    });
    expect(rows).toEqual([
      { month: '2026-02', actual: 125000, invested: 120000, r0: null },
      { month: '2026-03', actual: 150000, invested: 140000, r0: 150000 },
      { month: '2026-04', actual: null, invested: 160000, r0: 170000 },
      { month: '2026-05', actual: null, invested: 180000, r0: 190000 },
    ]);
  });

  it('va jusqu’à l’horizon, même au-delà de 10 ans', () => {
    const rows = regularChartRows({
      goal: { ...goal, targetDate: '2060-12-31' },
      months: [],
      month: '2026-03',
      current: 0,
      annualRates: [0.02, 0.09],
    });
    expect(rows.at(-1)?.month).toBe('2060-12');
    expect(rows.at(-1)?.['r0.09']).toBeGreaterThan(rows.at(-1)?.['r0.02'] as number);
  });
});
