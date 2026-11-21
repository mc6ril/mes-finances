import {
  commonMonthSummary,
  contributionsFor,
  defaultMemberName,
  memberLabel,
  memberName,
  memberSettlement,
  savingsPayerOf,
  settlementCandidates,
  suggestedEnvelope,
} from '@/core/commun/household';
import { accountBalanceAt } from '@/core/comptes/balances';
import type { CommonMonth, Dataset } from '@/core/shared/model';
import { createInitialDataset, DEFAULT_HOUSEHOLD } from '@/core/shared/seed';
import { aCategory, aMovement, anAccount, aTransaction } from '../fixtures';

const members = [
  { id: 'm1', name: 'Alex', salaryOnCommon: true },
  { id: 'm2', name: 'Sam', salaryOnCommon: false },
];

const october: CommonMonth = {
  month: '2026-10',
  envelope: null,
  savingsRates: [
    { accountId: 'acc-vacances', rate: 0.1 },
    { accountId: 'acc-immo', rate: 0.2 },
  ],
};

const november: CommonMonth = { month: '2026-11', envelope: 400000, savingsRates: null };

const income = (date: string, amount: number, memberId: string | null, outside = false) =>
  aTransaction({
    date,
    amount,
    accountId: 'acc-courant',
    type: 'revenu',
    categoryId: memberId ? 'cat-salaire' : 'cat-autres-entrees',
    label: memberId ? 'Salaire' : 'Intérêts',
    ...(memberId
      ? { imputation: { kind: 'revenu' as const, memberId, ...(outside ? { outside: true } : {}) } }
      : {}),
  });

const dataset = (overrides: Partial<Dataset> = {}): Dataset => {
  const base = createInitialDataset('2026-10-01', () => 'audit');
  return {
    ...base,
    settings: {
      ...base.settings,
      kind: 'commun',
      household: { members, contributionRate: 0.75, savingsPaidBy: 'commun' },
    },
    commonMonths: [october, november],
    transactions: [
      income('2026-10-01', 300000, 'm1'),
      income('2026-10-01', 250000, 'm2', true),
      income('2026-10-15', 12000, 'm2', true),
      income('2026-10-20', 7051, null),
      income('2026-11-01', 300000, 'm1'),
      income('2026-11-01', 262000, 'm2', true),
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
      savedRefunds: 0,
      withdrawals: 0,
      totalSaved: 127500,
      available: 304551,
      expenses: 153000,
      balance: 151551,
    });
  });

  it('reporte le bilan exact du mois précédent et reprend ses taux d’épargne', () => {
    expect(commonMonthSummary(dataset(), '2026-11')).toMatchObject({
      envelope: 400000,
      carriedOver: 151551,
      savingsTotal: 120000,
      expenses: 0,
      balance: 431551,
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

  it('reverse au membre un remboursement arrivé sur le commun pour lui, hors dépenses du commun', () => {
    const base = dataset();
    const refund = aTransaction({
      date: '2026-10-21',
      label: 'VIR INST MUTUELLE',
      amount: 5000,
      type: 'depense',
      categoryId: 'cat-sante',
      imputation: { kind: 'charge', memberId: 'm1' },
    });
    const withRefund = { ...base, transactions: [...base.transactions, refund] };
    const before = memberSettlement(base, '2026-10', 'm1');
    const after = memberSettlement(withRefund, '2026-10', 'm1');
    expect(after.lines.at(-1)).toMatchObject({ kind: 'charge', amount: 5000 });
    expect(after.toSettle - before.toSettle).toBe(5000);
    expect(commonMonthSummary(withRefund, '2026-10').expenses).toBe(
      commonMonthSummary(base, '2026-10').expenses,
    );
  });

  it('fait reverser au commun un remboursement reçu par le membre sur son compte', () => {
    const base = dataset();
    const received = aTransaction({
      date: '2026-10-21',
      amount: 5000,
      type: 'depense',
      imputation: { kind: 'avance', memberId: 'm1' },
    });
    const after = memberSettlement(
      { ...base, transactions: [...base.transactions, received] },
      '2026-10',
      'm1',
    );
    expect(after.toSettle - memberSettlement(base, '2026-10', 'm1').toSettle).toBe(-5000);
  });

  it('compte un ajustement hors compte dans le règlement, sans toucher au compte ni au budget', () => {
    const base = dataset();
    const withAdjustment = dataset({
      commonMonths: [
        {
          ...october,
          adjustments: [
            { id: 'adj-1', memberId: 'm1', label: 'Abonnement', amount: -4108 },
            { id: 'adj-2', memberId: 'm2', label: 'Part billetterie', amount: 15400 },
          ],
        },
        november,
      ],
    });
    const after = memberSettlement(withAdjustment, '2026-10', 'm1');
    expect(after.lines.at(-1)).toEqual({
      kind: 'adjustment',
      label: 'Abonnement',
      amount: -4108,
      adjustmentId: 'adj-1',
    });
    expect(after.toSettle - memberSettlement(base, '2026-10', 'm1').toSettle).toBe(-4108);
    expect(
      memberSettlement(withAdjustment, '2026-10', 'm2').toSettle -
        memberSettlement(base, '2026-10', 'm2').toSettle,
    ).toBe(15400);
    expect(commonMonthSummary(withAdjustment, '2026-10')).toEqual(commonMonthSummary(base, '2026-10'));
    const account = base.accounts.find((candidate) => candidate.id === 'acc-courant')!;
    expect(accountBalanceAt(account, withAdjustment.transactions, '2026-10-31')).toBe(
      accountBalanceAt(account, base.transactions, '2026-10-31'),
    );
    expect(memberSettlement(withAdjustment, '2026-11', 'm1').carriedOver).toBe(
      memberSettlement(base, '2026-11', 'm1').carriedOver - 4108,
    );
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
    // salaire d’Alex et intérêts entrent ; salaire de Sam et avance restent hors du compte
    expect(accountBalanceAt(account, dataset().transactions, '2026-10-31')).toBe(
      300000 + 7051 - 150000 - 5000,
    );
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

describe('remboursement reçu pour un membre et charge hors compte', () => {
  it('un remboursement reçu sur le commun pour un membre lui est dû, sans être une entrée du commun', () => {
    const data = dataset({
      transactions: [
        ...dataset().transactions,
        aTransaction({
          date: '2026-10-21',
          amount: 5000,
          type: 'revenu',
          accountId: 'acc-courant',
          categoryId: null,
          label: 'Mutuelle',
          imputation: { kind: 'charge', memberId: 'm1' },
        }),
      ],
    });
    expect(commonMonthSummary(data, '2026-10').inflows).toBe(7051);
    const lines = memberSettlement(data, '2026-10', 'm1').lines;
    expect(lines.at(-1)).toMatchObject({ kind: 'charge', amount: 5000, label: 'Mutuelle' });
  });

  it('une charge payée hors du compte réduit la part du membre sans toucher le solde', () => {
    const outside = aTransaction({
      date: '2026-10-25',
      amount: -15400,
      type: 'depense',
      accountId: 'acc-courant',
      imputation: { kind: 'charge', memberId: 'm1', outside: true },
    });
    const account = anAccount({ id: 'acc-courant', openingDate: '2026-10-01' });
    expect(accountBalanceAt(account, [outside], '2026-10-31')).toBe(0);
    const data = dataset({ transactions: [...dataset().transactions, outside] });
    expect(memberSettlement(data, '2026-10', 'm1').due).toBe(68132 - 15400);
  });
});

describe('revenus versés hors du commun', () => {
  it('reprend le montant saisi, ou celui du dernier mois qui en indique un', () => {
    const data = dataset({
      transactions: [income('2026-10-01', 300000, 'm1'), income('2026-11-01', 300000, 'm1')],
      commonMonths: [{ ...october, outsideIncomes: { m2: 250000 } }, november],
    });
    expect(commonMonthSummary(data, '2026-10').incomes).toEqual({ m1: 300000, m2: 250000 });
    expect(commonMonthSummary(data, '2026-11').incomes).toEqual({ m1: 300000, m2: 250000 });
    expect(commonMonthSummary(data, '2026-10').suggestedEnvelope).toBe(415000);
  });

  it('ignore le montant saisi pour un membre dont le salaire arrive sur le commun', () => {
    const data = dataset({
      transactions: [income('2026-10-01', 300000, 'm1')],
      commonMonths: [{ ...october, outsideIncomes: { m1: 999900 } }],
    });
    expect(commonMonthSummary(data, '2026-10').incomes.m1).toBe(300000);
  });
});

describe('settlementCandidates', () => {
  const transfer = (id: string, date: string, amount: number, label: string) =>
    aTransaction({ id, date, amount, accountId: 'acc-courant', type: 'virement', label });

  it('propose les virements non rattachés, au nom du membre et au montant proche d’abord', () => {
    const base = dataset();
    const toSettle = memberSettlement(base, '2026-10', 'm1').toSettle;
    expect(toSettle).toBeGreaterThan(0);
    const data = dataset({
      transactions: [
        ...base.transactions,
        transfer('far', '2026-11-05', -10000, 'VIR INST AUTRE'),
        transfer('exact', '2026-11-12', -toSettle, 'VIR INST AUTRE'),
        transfer('named', '2026-11-20', -5000, 'VIR INST ALEX DUPONT'),
        transfer('wrong-way', '2026-11-12', toSettle, 'VIR INST ALEX'),
        transfer('too-late', '2027-01-10', -toSettle, 'VIR INST ALEX'),
        transfer('linked', '2026-11-12', -toSettle, 'VIR INST ALEX'),
      ],
      settlements: [
        { id: 's', month: '2026-09', memberId: 'm1', amount: 1, date: '2026-10-01', transactionId: 'linked' },
      ],
    });
    expect(settlementCandidates(data, '2026-10', 'm1').map((transaction) => transaction.id)).toEqual([
      'named',
      'exact',
      'far',
    ]);
  });
});

describe('épargne versée par un membre', () => {
  it('compte l’épargne du mois dans la part de celui qui la verse', () => {
    const base = dataset();
    const paidBySam = {
      ...base,
      settings: {
        ...base.settings,
        household: { ...base.settings.household!, savingsPaidBy: 'm2' },
      },
    };
    const savings = commonMonthSummary(base, '2026-10').savingsTotal;
    expect(savings).toBeGreaterThan(0);
    const before = memberSettlement(base, '2026-10', 'm2');
    const after = memberSettlement(paidBySam, '2026-10', 'm2');
    expect(after.due).toBe(before.due + savings);
    expect(after.lines).toContainEqual({
      kind: 'savings',
      label: 'Épargne versée sur les livrets',
      amount: savings,
    });
    expect(memberSettlement(paidBySam, '2026-10', 'm1').due).toBe(
      memberSettlement(base, '2026-10', 'm1').due,
    );
  });
});

describe('remboursement reçu par un membre et placé sur un livret', () => {
  const livret = anAccount({
    id: 'acc-vacances',
    name: 'Livret vacances',
    kind: 'livret',
    group: 'securise',
  });
  const refund = (accountId: string) =>
    aTransaction({
      id: 'maif',
      date: '2026-10-22',
      amount: 10500,
      type: 'depense',
      accountId,
      label: 'MAIF vol vélos',
      imputation: { kind: 'avance', memberId: 'm2' },
    });
  const withRefund = (accountId: string) => {
    const base = dataset();
    return {
      ...base,
      accounts: [...base.accounts, livret],
      settings: { ...base.settings, household: { ...base.settings.household!, savingsPaidBy: 'm2' } },
      transactions: [...base.transactions, refund(accountId)],
    };
  };

  it('ne change rien au règlement du membre : il l’a reçu et l’a versé au livret', () => {
    const before = memberSettlement(withRefund('acc-courant'), '2026-10', 'm2');
    const after = memberSettlement(withRefund('acc-vacances'), '2026-10', 'm2');
    expect(after.due).toBe(before.due + 10500);
    expect(after.lines).toContainEqual({
      kind: 'savings',
      label: 'MAIF vol vélos',
      amount: 10500,
      transactionId: 'maif',
    });
    const withoutRefund = memberSettlement(
      { ...withRefund('acc-vacances'), transactions: dataset().transactions },
      '2026-10',
      'm2',
    );
    expect(after.due).toBe(withoutRefund.due);
  });

  it('compte dans l’épargne du commun, pas dans son disponible', () => {
    const summary = commonMonthSummary(withRefund('acc-vacances'), '2026-10');
    const onCommon = commonMonthSummary(withRefund('acc-courant'), '2026-10');
    expect(summary.savedRefunds).toBe(10500);
    expect(summary.totalSaved).toBe(summary.savingsTotal + 10500);
    expect(summary.expenses).toBe(onCommon.expenses);
    expect(summary.balance).toBe(onCommon.balance - 10500);
  });
});

describe('retrait d’épargne par le membre qui détient les livrets', () => {
  const livret = anAccount({
    id: 'acc-vacances',
    name: 'Livret vacances',
    kind: 'livret',
    group: 'securise',
  });
  const retrait = aMovement({
    id: 'retrait',
    accountId: 'acc-vacances',
    kind: 'retrait',
    amount: 90000,
    date: '2026-10-28',
    comment: 'Barcelone',
  });
  const withWithdrawal = (savingsPaidBy: string, movements = [retrait]) => {
    const base = dataset();
    return {
      ...base,
      accounts: [...base.accounts, livret],
      settings: { ...base.settings, household: { ...base.settings.household!, savingsPaidBy } },
      savingsMovements: movements,
    };
  };

  it('est dû au commun par ce membre : l’argent arrive sur son compte', () => {
    const without = memberSettlement(withWithdrawal('m2', []), '2026-10', 'm2');
    const after = memberSettlement(withWithdrawal('m2'), '2026-10', 'm2');
    expect(after.due).toBe(without.due - 90000);
    expect(after.lines).toContainEqual({
      kind: 'withdrawal',
      label: 'Barcelone',
      amount: -90000,
      movementId: 'retrait',
    });
    expect(memberSettlement(withWithdrawal('m2'), '2026-10', 'm1').due).toBe(
      memberSettlement(withWithdrawal('m2', []), '2026-10', 'm1').due,
    );
  });

  it('alimente le disponible du commun comme retrait d’épargne, pas comme autre entrée', () => {
    const without = commonMonthSummary(withWithdrawal('m2', []), '2026-10');
    const summary = commonMonthSummary(withWithdrawal('m2'), '2026-10');
    expect(summary.withdrawals).toBe(90000);
    expect(summary.inflows).toBe(without.inflows);
    expect(summary.available).toBe(without.available + 90000);
  });

  it('nomme la ligne « Retrait d’épargne » quand le retrait n’a pas de commentaire', () => {
    const lines = memberSettlement(
      withWithdrawal('m2', [{ ...retrait, comment: ' ' }]),
      '2026-10',
      'm2',
    ).lines;
    expect(lines).toContainEqual(expect.objectContaining({ kind: 'withdrawal', label: 'Retrait d’épargne' }));
  });

  it('ignore le retrait d’un autre mois, les autres mouvements et un retrait viré sur le commun', () => {
    const others = [
      { ...retrait, id: 'novembre', date: '2026-11-02' },
      { ...retrait, id: 'interets', kind: 'interets' as const },
    ];
    expect(commonMonthSummary(withWithdrawal('m2', others), '2026-10').withdrawals).toBe(0);
    const mirrored = withWithdrawal('m2');
    const toCommon = aTransaction({
      date: '2026-10-28',
      amount: 90000,
      type: 'virement',
      accountId: 'acc-courant',
      counterpartAccountId: 'acc-vacances',
    });
    expect(
      commonMonthSummary({ ...mirrored, transactions: [...mirrored.transactions, toCommon] }, '2026-10')
        .withdrawals,
    ).toBe(0);
  });

  it('ne compte rien quand l’épargne part du compte commun', () => {
    expect(commonMonthSummary(withWithdrawal('commun'), '2026-10').withdrawals).toBe(0);
  });
});

describe('salaires sur le commun : les deux ou aucun', () => {
  const withSalaries = (m1: boolean, m2: boolean, transactions: Dataset['transactions']) =>
    dataset({
      settings: {
        ...dataset().settings,
        household: {
          members: [
            { id: 'm1', name: 'Alex', salaryOnCommon: m1 },
            { id: 'm2', name: 'Sam', salaryOnCommon: m2 },
          ],
          contributionRate: 0.5,
          savingsPaidBy: 'commun',
        },
      },
      commonMonths: [{ month: '2026-10', envelope: null, savingsRates: null }],
      transactions,
    });

  it('reverse à chacun ce qui dépasse sa part quand les deux salaires arrivent sur le commun', () => {
    const data = withSalaries(true, true, [
      income('2026-10-01', 300000, 'm1'),
      income('2026-10-01', 200000, 'm2'),
    ]);
    expect(commonMonthSummary(data, '2026-10')).toMatchObject({ totalIncome: 500000, envelope: 250000 });
    expect(memberSettlement(data, '2026-10', 'm1').toSettle).toBe(150000);
    expect(memberSettlement(data, '2026-10', 'm2').toSettle).toBe(100000);
  });

  it('fait verser sa part à chacun quand aucun salaire n’arrive sur le commun', () => {
    const data = withSalaries(false, false, [
      income('2026-10-01', 300000, 'm1', true),
      income('2026-10-01', 200000, 'm2', true),
    ]);
    expect(commonMonthSummary(data, '2026-10')).toMatchObject({ totalIncome: 500000, envelope: 250000 });
    expect(memberSettlement(data, '2026-10', 'm1').toSettle).toBe(-150000);
    expect(memberSettlement(data, '2026-10', 'm2').toSettle).toBe(-100000);
  });

  it('épargne : le commun la verse si les deux salaires y arrivent, sinon le premier payé ailleurs', () => {
    const both = members.map((member) => ({ ...member, salaryOnCommon: true }));
    const none = members.map((member) => ({ ...member, salaryOnCommon: false }));
    expect(savingsPayerOf({ members: both, contributionRate: 0.5 })).toBeNull();
    expect(savingsPayerOf({ members: none, contributionRate: 0.5 })).toBe('m1');
  });
});

describe('savingsPayerOf', () => {
  it('par défaut, le membre dont le salaire n’arrive pas sur le commun verse l’épargne', () => {
    expect(savingsPayerOf({ members, contributionRate: 0.75 })).toBe('m2');
    expect(savingsPayerOf({ members, contributionRate: 0.75, savingsPaidBy: null })).toBe('m2');
    expect(savingsPayerOf({ members, contributionRate: 0.75, savingsPaidBy: 'commun' })).toBeNull();
    expect(savingsPayerOf({ members, contributionRate: 0.75, savingsPaidBy: 'm1' })).toBe('m1');
    expect(savingsPayerOf(null)).toBeNull();
  });
});

describe('nom affiché d’un membre', () => {
  const members = [
    { id: 'a', name: 'Alex', salaryOnCommon: true },
    { id: 'b', name: '  ', salaryOnCommon: false },
  ];

  it('donne le prénom renseigné', () => {
    expect(memberName(members, 'a')).toBe('Alex');
  });

  it('donne « Membre N » tant que le prénom n’est pas renseigné', () => {
    expect(memberName(members, 'b')).toBe('Membre 2');
    expect(defaultMemberName(0)).toBe('Membre 1');
  });

  it('lit les membres du foyer de l’espace', () => {
    const dataset = createInitialDataset('2026-10-01', () => 'id');
    const household = { ...DEFAULT_HOUSEHOLD, members };
    const commun = { ...dataset, settings: { ...dataset.settings, household } };
    expect(memberLabel(commun, 'a')).toBe('Alex');
    expect(memberLabel(commun, 'b')).toBe('Membre 2');
  });
});
