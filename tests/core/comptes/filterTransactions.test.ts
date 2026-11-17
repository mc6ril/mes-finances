import {
  ALL,
  defaultFilters,
  filterTransactions,
  TO_CLASSIFY,
  toClassifyRange,
  type TransactionFilters,
} from '@/core/comptes/filters';
import { aTransaction } from '../fixtures';

const filters = (overrides: Partial<TransactionFilters> = {}): TransactionFilters => ({
  from: '2026-03-01',
  to: '2026-03-31',
  search: '',
  categoryId: ALL,
  type: ALL,
  status: ALL,
  minAmount: '',
  maxAmount: '',
  ...overrides,
});

const ids = (transactions: { id: string }[]) => transactions.map((transaction) => transaction.id);

describe('filtrage des opérations d’un compte', () => {
  it('garde les opérations du compte et celles dont il est la contrepartie', () => {
    const own = aTransaction();
    const incoming = aTransaction({ accountId: 'livret', counterpartAccountId: 'courant', type: 'virement' });
    const other = aTransaction({ accountId: 'livret' });
    expect(ids(filterTransactions([own, incoming, other], 'courant', filters()))).toEqual([
      own.id,
      incoming.id,
    ]);
  });

  it('inclut les bornes de la période', () => {
    const before = aTransaction({ date: '2026-02-28' });
    const first = aTransaction({ date: '2026-03-01' });
    const last = aTransaction({ date: '2026-03-31' });
    const after = aTransaction({ date: '2026-04-01' });
    expect(ids(filterTransactions([before, first, last, after], 'courant', filters()))).toEqual([
      first.id,
      last.id,
    ]);
  });

  it('cherche sans tenir compte des accents ni de la casse, dans le libellé et le commentaire', () => {
    const label = aTransaction({ label: 'Café de la Gare' });
    const comment = aTransaction({ label: 'CB', comment: 'déjeuner café' });
    const none = aTransaction({ label: 'Boulangerie' });
    expect(
      ids(filterTransactions([label, comment, none], 'courant', filters({ search: '  CAFE ' }))),
    ).toEqual([label.id, comment.id]);
  });

  it('filtre par catégorie, sans catégorie ou à classer', () => {
    const classified = aTransaction({ categoryId: 'restaurants' });
    const other = aTransaction({ categoryId: 'courses' });
    const toClassify = aTransaction({ categoryId: null });
    const plannedWithout = aTransaction({ categoryId: null, status: 'prevu' });
    const all = [classified, other, toClassify, plannedWithout];
    expect(ids(filterTransactions(all, 'courant', filters({ categoryId: 'restaurants' })))).toEqual([
      classified.id,
    ]);
    expect(ids(filterTransactions(all, 'courant', filters({ categoryId: 'none' })))).toEqual([
      toClassify.id,
      plannedWithout.id,
    ]);
    expect(ids(filterTransactions(all, 'courant', filters({ categoryId: TO_CLASSIFY })))).toEqual([
      toClassify.id,
    ]);
    expect(filterTransactions(all, 'courant', filters())).toHaveLength(4);
  });

  it('filtre par type et par statut', () => {
    const spending = aTransaction({ type: 'depense' });
    const income = aTransaction({ type: 'revenu', amount: 5000 });
    const planned = aTransaction({ status: 'prevu' });
    const all = [spending, income, planned];
    expect(ids(filterTransactions(all, 'courant', filters({ type: 'revenu' })))).toEqual([income.id]);
    expect(ids(filterTransactions(all, 'courant', filters({ status: 'prevu' })))).toEqual([planned.id]);
  });

  it('compare le montant en valeur absolue de l’effet sur le compte, bornes incluses', () => {
    const small = aTransaction({ amount: -500 });
    const medium = aTransaction({ amount: -1000 });
    const large = aTransaction({ amount: 2000, type: 'revenu' });
    const transfer = aTransaction({
      accountId: 'livret',
      counterpartAccountId: 'courant',
      type: 'virement',
      amount: 1500,
    });
    const all = [small, medium, large, transfer];
    expect(ids(filterTransactions(all, 'courant', filters({ minAmount: '10', maxAmount: '15,00' })))).toEqual(
      [medium.id, transfer.id],
    );
  });

  it('ignore un montant illisible', () => {
    const all = [aTransaction({ amount: -500 }), aTransaction({ amount: -5000 })];
    expect(filterTransactions(all, 'courant', filters({ minAmount: 'abc', maxAmount: 'x' }))).toHaveLength(2);
  });
});

describe('période des opérations à classer', () => {
  it('couvre de la plus ancienne à la plus récente opération à classer du compte', () => {
    const transactions = [
      aTransaction({ categoryId: null, date: '2026-05-04' }),
      aTransaction({ categoryId: null, date: '2025-11-20' }),
      aTransaction({ categoryId: null, date: '2024-01-01', accountId: 'livret' }),
      aTransaction({ categoryId: 'restaurants', date: '2023-01-01' }),
    ];
    expect(toClassifyRange(transactions, 'courant', '2026-03')).toEqual({
      from: '2025-11-20',
      to: '2026-05-04',
    });
  });

  it('retombe sur le mois affiché quand rien n’est à classer', () => {
    expect(toClassifyRange([], 'courant', '2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('filtres de départ', () => {
  it('affiche tout le mois sans autre critère', () => {
    expect(
      defaultFilters({ transactions: [], accountId: 'courant', month: '2026-03', toClassify: false }),
    ).toEqual(filters());
  });

  it('affiche les opérations à classer, toutes dates', () => {
    const transactions = [aTransaction({ categoryId: null, date: '2025-12-02' })];
    expect(
      defaultFilters({ transactions, accountId: 'courant', month: '2026-03', toClassify: true }),
    ).toEqual(filters({ from: '2025-12-02', to: '2025-12-02', categoryId: TO_CLASSIFY }));
  });
});
