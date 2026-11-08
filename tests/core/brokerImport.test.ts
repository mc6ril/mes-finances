import { parseBrokerExport, planBrokerImport } from '@/core/brokerImport';
import { anAccount, aMovement, aTransaction } from './fixtures';

const HEADER = [
  'datetime',
  'date',
  'account_type',
  'category',
  'type',
  'asset_class',
  'name',
  'symbol',
  'shares',
  'price',
  'amount',
  'fee',
  'tax',
  'currency',
  'description',
  'transaction_id',
];

const row = (values: Partial<Record<string, string>>): string[] =>
  HEADER.map((column) => values[column] ?? '');

const rows = [
  HEADER,
  row({
    date: '2026-06-15',
    category: 'CASH',
    type: 'TRANSFER_INSTANT_INBOUND',
    name: 'Jean D.',
    amount: '100.000000',
    transaction_id: 't-1',
  }),
  row({
    date: '2026-06-15',
    category: 'TRADING',
    type: 'BUY',
    amount: '-50.00',
    fee: '-1.00',
    transaction_id: 't-2',
  }),
  row({
    date: '2026-07-02',
    category: 'TRADING',
    type: 'BUY',
    amount: '-10.00',
    tax: '-0.04',
    transaction_id: 't-3',
  }),
  row({ date: '2026-08-13', category: 'CASH', type: 'DIVIDEND', amount: '0.030000', transaction_id: 't-4' }),
  row({
    date: '2026-09-21',
    category: 'TRADING',
    type: 'SELL',
    amount: '28.22',
    fee: '-1.00',
    transaction_id: 't-5',
  }),
  row({
    date: '2026-10-01',
    category: 'CASH',
    type: 'DIVIDEND',
    amount: '0.060000',
    tax: '-0.03',
    transaction_id: 't-6',
  }),
  row({
    date: '2026-10-05',
    category: 'CASH',
    type: 'TRANSFER_OUTBOUND',
    amount: '-20.000000',
    transaction_id: 't-7',
  }),
  row({
    date: '2026-11-02',
    category: 'CASH',
    type: 'TRANSFER_INBOUND',
    amount: '100.000000',
    transaction_id: 't-8',
  }),
];

describe('parseBrokerExport', () => {
  const result = parseBrokerExport(rows);

  it('reconnaît le format d’export Trade Republic', () => {
    expect(result.ok).toBe(true);
  });

  it('transforme les virements entrants en versements et sortants en retraits', () => {
    const transfers = result.ok
      ? result.drafts.filter((draft) => draft.kind === 'versement' || draft.kind === 'retrait')
      : [];
    expect(transfers).toEqual([
      expect.objectContaining({ externalId: 't-1', date: '2026-06-15', kind: 'versement', amount: 10000 }),
      expect.objectContaining({ externalId: 't-7', date: '2026-10-05', kind: 'retrait', amount: 2000 }),
      expect.objectContaining({ externalId: 't-8', date: '2026-11-02', kind: 'versement', amount: 10000 }),
    ]);
  });

  it('compte les dividendes comme des revenus du placement', () => {
    const dividends = result.ok ? result.drafts.filter((draft) => draft.kind === 'interets') : [];
    expect(dividends.map((draft) => draft.amount)).toEqual([3, 6]);
  });

  it('regroupe frais et taxes de chaque opération en frais', () => {
    const fees = result.ok ? result.drafts.filter((draft) => draft.kind === 'frais') : [];
    expect(fees.map((draft) => [draft.externalId, draft.amount])).toEqual([
      ['t-2:frais', 100],
      ['t-3:frais', 4],
      ['t-5:frais', 100],
      ['t-6:frais', 3],
    ]);
  });

  it('ignore les achats et ventes, internes au compte', () => {
    const fromTrades = result.ok
      ? result.drafts.filter((draft) => ['t-2', 't-3', 't-5'].includes(draft.externalId))
      : [];
    expect(fromTrades).toEqual([]);
  });

  it('ne conserve aucune donnée personnelle de contrepartie', () => {
    const text = JSON.stringify(result);
    expect(text).not.toContain('Jean D.');
  });

  it('refuse un fichier d’un autre format', () => {
    expect(parseBrokerExport([['Date', 'Libellé', 'Montant']])).toMatchObject({ ok: false });
  });
});

describe('planBrokerImport', () => {
  const drafts = (() => {
    const parsed = parseBrokerExport(rows);
    return parsed.ok ? parsed.drafts : [];
  })();
  const account = anAccount({
    id: 'tr',
    kind: 'bourse',
    group: 'investissement',
    openingBalance: 51360,
    openingDate: '2026-11-05',
  });

  it('propose de faire démarrer le compte au premier mouvement, solde initial à zéro', () => {
    const plan = planBrokerImport({ drafts, account, movements: [], transactions: [] });
    expect(plan.openingAdjustment).toEqual({ openingDate: '2026-06-15', openingBalance: 0 });
  });

  it('ne propose rien si le compte est déjà ouvert avant le premier mouvement', () => {
    const plan = planBrokerImport({
      drafts,
      account: { ...account, openingDate: '2026-01-01' },
      movements: [],
      transactions: [],
    });
    expect(plan.openingAdjustment).toBeNull();
  });

  it('écarte les lignes déjà importées', () => {
    const movements = [aMovement({ accountId: 'tr', externalId: 't-1', amount: 10000, date: '2026-06-15' })];
    const plan = planBrokerImport({ drafts, account, movements, transactions: [] });
    expect(plan.rows.find((entry) => entry.draft.externalId === 't-1')?.status).toBe('deja-importe');
  });

  it('écarte un versement déjà saisi depuis le compte courant', () => {
    const transactions = [
      aTransaction({
        date: '2026-11-03',
        amount: -10000,
        type: 'investissement',
        counterpartAccountId: 'tr',
        categoryId: null,
      }),
    ];
    const plan = planBrokerImport({ drafts, account, movements: [], transactions });
    expect(plan.rows.find((entry) => entry.draft.externalId === 't-8')?.status).toBe('deja-saisi');
  });

  it('résume ce qui sera importé', () => {
    const plan = planBrokerImport({ drafts, account, movements: [], transactions: [] });
    expect(plan.totals).toEqual({ deposits: 20000, withdrawals: 2000, income: 9, fees: 207 });
  });
});
