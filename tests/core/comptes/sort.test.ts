import { DEFAULT_SORT, nextSort, sortTransactions, type SortState } from '@/core/comptes/sort';
import { aTransaction } from '../fixtures';

const names = new Map([
  ['restaurants', 'Restaurants'],
  ['courses', 'Courses'],
]);

const ids = (transactions: { id: string }[]) => transactions.map((transaction) => transaction.id);

const sorted = (transactions: ReturnType<typeof aTransaction>[], sort: SortState) =>
  ids(sortTransactions(transactions, sort, 'courant', names));

describe('tri des opérations', () => {
  const march = aTransaction({
    date: '2026-03-10',
    label: 'banane',
    amount: -300,
    categoryId: 'restaurants',
  });
  const april = aTransaction({ date: '2026-04-02', label: 'Abricot', amount: 1200, categoryId: 'courses' });
  const may = aTransaction({ date: '2026-05-20', label: 'cerise', amount: -50, categoryId: null });

  it('trie par date, du plus récent au plus ancien par défaut', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'date', direction: -1 });
    expect(sorted([march, may, april], DEFAULT_SORT)).toEqual([may.id, april.id, march.id]);
    expect(sorted([march, may, april], { key: 'date', direction: 1 })).toEqual([march.id, april.id, may.id]);
  });

  it('trie par libellé sans tenir compte de la casse', () => {
    expect(sorted([march, may, april], { key: 'label', direction: 1 })).toEqual([april.id, march.id, may.id]);
  });

  it('trie par effet signé sur le compte', () => {
    const incoming = aTransaction({
      accountId: 'livret',
      counterpartAccountId: 'courant',
      type: 'virement',
      amount: -800,
    });
    expect(sorted([march, may, april, incoming], { key: 'amount', direction: 1 })).toEqual([
      march.id,
      may.id,
      incoming.id,
      april.id,
    ]);
  });

  it('trie par nom de catégorie, une opération sans catégorie en premier', () => {
    expect(sorted([march, may, april], { key: 'category', direction: 1 })).toEqual([
      may.id,
      april.id,
      march.id,
    ]);
  });

  it('départage les égalités par création, la plus récente d’abord, quel que soit le sens', () => {
    const older = aTransaction({ createdAt: '2026-03-01T08:00:00.000Z' });
    const newer = aTransaction({ createdAt: '2026-03-02T08:00:00.000Z' });
    expect(sorted([older, newer], { key: 'date', direction: 1 })).toEqual([newer.id, older.id]);
    expect(sorted([older, newer], { key: 'date', direction: -1 })).toEqual([newer.id, older.id]);
  });

  it('ne modifie pas la liste reçue', () => {
    const input = [march, may, april];
    sortTransactions(input, DEFAULT_SORT, 'courant', names);
    expect(ids(input)).toEqual([march.id, may.id, april.id]);
  });
});

describe('changement de tri', () => {
  it('inverse le sens sur la même colonne', () => {
    expect(nextSort({ key: 'date', direction: -1 }, 'date')).toEqual({ key: 'date', direction: 1 });
    expect(nextSort({ key: 'date', direction: 1 }, 'date')).toEqual({ key: 'date', direction: -1 });
  });

  it('part du sens décroissant sur une nouvelle colonne', () => {
    expect(nextSort({ key: 'date', direction: 1 }, 'amount')).toEqual({ key: 'amount', direction: -1 });
  });
});
