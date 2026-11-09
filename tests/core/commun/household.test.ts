import { accountBalanceAt } from '@/core/comptes/balances';
import {
  commonMonthSummary,
  contributionsFor,
  memberSettlement,
  suggestedEnvelope,
} from '@/core/commun/household';
import type { CommonMonth, Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aCategory, anAccount, aTransaction } from '../fixtures';

const members = [
  { id: 'm1', name: 'Alex', salaryOnCommon: true },
  { id: 'm2', name: 'Sam', salaryOnCommon: false },
];

const october: CommonMonth = {
  month: '2026-10',
  incomes: [
    { id: 'i1', memberId: 'm1', label: 'Salaire', amount: 300000 },
    { id: 'i2', memberId: 'm2', label: 'Salaire', amount: 250000 },
    { id: 'i3', memberId: 'm2', label: 'Prime', amount: 12000 },
  ],
  envelope: null,
  inflows: [{ id: 'x1', label: 'Intérêts', amount: 7051 }],
  savingsRates: [
    { accountId: 'acc-vacances', rate: 0.1 },
    { accountId: 'acc-immo', rate: 0.2 },
  ],
};

const november: CommonMonth = {
  month: '2026-11',
  incomes: [
    { id: 'i4', memberId: 'm1', label: 'Salaire', amount: 300000 },
    { id: 'i5', memberId: 'm2', label: 'Salaire', amount: 262000 },
  ],
  envelope: 400000,
  inflows: [],
  savingsRates: null,
};

const dataset = (overrides: Partial<Dataset> = {}): Dataset => {
  const base = createInitialDataset('2026-10-01', () => 'audit');
  return {
    ...base,
    settings: { ...base.settings, kind: 'commun', household: { members, contributionRate: 0.75 } },
    commonMonths: [october, november],
    transactions: [
      aTransaction({ date: '2026-10-05', amount: -150000, accountId: 'acc-courant', type: 'depense' }),
      aTransaction({
        date: '2026-10-12',
        amount: -5000,
        accountId: 'acc-courant',
        type: 'depense',
        label: 'Achat perso',
        imputation: { kind: 'charge', memberId: 'm1' },
      }),
      aTransaction({
        date: '2026-10-20',
        amount: -3000,
        accountId: 'acc-courant',
        type: 'depense',
        label: 'Pharmacie',
        imputation: { kind: 'avance', memberId: 'm2' },
      }),
    ],
    ...overrides,
  };
};

describe('enveloppe commune', () => {
  it('propose x % des revenus, arrondi aux 50 € supérieurs', () => {
    expect(suggestedEnvelope(562000, 0.75)).toBe(425000);
    expect(suggestedEnvelope(560000, 0.75)).toBe(420000);
    expect(suggestedEnvelope(0, 0.75)).toBe(0);
  });

  it('répartit l’enveloppe au prorata des revenus, sans centime perdu', () => {
    expect(contributionsFor(425000, { m1: 300000, m2: 262000 }, members)).toEqual({
      m1: 226868,
      m2: 198132,
    });
    expect(contributionsFor(425000, {}, members)).toEqual({ m1: 0, m2: 0 });
  });
});

describe('mois du commun', () => {
  it('calcule contributions, épargne, disponible et bilan', () => {
    expect(commonMonthSummary(dataset(), '2026-10')).toEqual({
      incomes: { m1: 300000, m2: 262000 },
      totalIncome: 562000,
      suggestedEnvelope: 425000,
      envelope: 425000,
      contributions: { m1: 226868, m2: 198132 },
      carriedOver: 0,
      inflows: 7051,
      savings: [
        { accountId: 'acc-vacances', rate: 0.1, amount: 42500 },
        { accountId: 'acc-immo', rate: 0.2, amount: 85000 },
      ],
      savingsTotal: 127500,
      available: 304551,
      expenses: 153000,
      balance: 151551,
    });
  });

  it('reporte le bilan du mois précédent arrondi à l’euro et reprend ses taux d’épargne', () => {
    expect(commonMonthSummary(dataset(), '2026-11')).toMatchObject({
      envelope: 400000,
      carriedOver: 151600,
      savingsTotal: 120000,
      expenses: 0,
      balance: 431600,
    });
  });

  it('part de zéro pour un mois sans saisie avant le premier mois suivi', () => {
    expect(commonMonthSummary(dataset(), '2026-09')).toMatchObject({
      envelope: 0,
      carriedOver: 0,
      balance: 0,
    });
  });
});

describe('règlement de fin de mois', () => {
  it('reverse son solde à celui dont le salaire arrive sur le commun', () => {
    const settlement = memberSettlement(dataset(), '2026-10', 'm1');
    expect(settlement.lines.map((line) => [line.kind, line.amount])).toEqual([
      ['income', 300000],
      ['contribution', -226868],
      ['charge', -5000],
    ]);
    expect(settlement).toMatchObject({ due: 68132, carriedOver: 0, settled: 0, toSettle: 68132 });
  });

  it('fait verser sa part à l’autre, moins ce qu’il a avancé', () => {
    const settlement = memberSettlement(dataset(), '2026-10', 'm2');
    expect(settlement.lines.map((line) => [line.kind, line.amount])).toEqual([
      ['contribution', -198132],
      ['avance', 3000],
    ]);
    expect(settlement.toSettle).toBe(-195132);
  });

  it('reporte ce qui n’a pas été réglé le mois précédent', () => {
    const data = dataset({
      settlements: [
        {
          id: 's1',
          month: '2026-10',
          memberId: 'm1',
          amount: 60000,
          date: '2026-10-31',
          transactionId: null,
        },
      ],
    });
    expect(memberSettlement(data, '2026-10', 'm1')).toMatchObject({ settled: 60000, toSettle: 8132 });
    expect(memberSettlement(data, '2026-11', 'm1')).toMatchObject({
      due: 300000 - 213523,
      carriedOver: 8132,
      toSettle: 300000 - 213523 + 8132,
    });
    expect(memberSettlement(data, '2026-11', 'm2').carriedOver).toBe(-195132);
  });
});

describe('opération avancée par un membre', () => {
  it('compte dans les dépenses du commun mais ne touche pas le solde bancaire', () => {
    const account = anAccount({ id: 'acc-courant', openingDate: '2026-10-01' });
    expect(accountBalanceAt(account, dataset().transactions, '2026-10-31')).toBe(-155000);
  });
});

describe('budget du commun', () => {
  it('ne compte pas une dépense à la charge d’un membre dans les catégories', async () => {
    const { categoryActuals } = await import('@/core/budget/budget');
    const transactions = [
      aTransaction({
        date: '2026-10-12',
        amount: -5000,
        categoryId: 'restaurants',
        imputation: { kind: 'charge', memberId: 'm1' },
      }),
      aTransaction({ date: '2026-10-13', amount: -2000, categoryId: 'restaurants' }),
    ];
    expect(categoryActuals(transactions, [aCategory()], '2026-10').restaurants?.actual).toBe(2000);
  });
});
