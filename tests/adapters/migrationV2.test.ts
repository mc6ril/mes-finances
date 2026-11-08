import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { FinanceStore } from '@/app/FinanceStore';
import { createInitialDataset } from '@/core/seed';
import { SCHEMA_VERSION } from '@/core/model';

const V1_STORES = [
  'accounts',
  'categories',
  'transactions',
  'savingsMovements',
  'valuations',
  'budgets',
  'recurrings',
  'goals',
  'audit',
];

const createV1Database = async (name: string) => {
  const seed = createInitialDataset('2026-11-05', () => 'audit-1');
  const db = await openDB(name, 1, {
    upgrade(database) {
      database.createObjectStore('meta');
      V1_STORES.forEach((store) =>
        database.createObjectStore(store, { keyPath: store === 'budgets' ? 'month' : 'id' }),
      );
    },
  });
  await db.put('meta', seed.settings, 'settings');
  await db.put('meta', 1, 'schemaVersion');
  await Promise.all(
    seed.categories.map(({ period: _period, ...category }) => db.put('categories', category)),
  );
  await Promise.all(seed.accounts.map((account) => db.put('accounts', account)));
  await db.put('budgets', {
    month: '2026-11',
    planned: { 'cat-voyages': 2000, 'cat-restaurants': 8000 },
    carryOver: false,
  });
  await db.put('transactions', {
    id: 'tx-perso',
    date: '2026-11-04',
    label: 'Café',
    amount: -250,
    accountId: 'acc-courant',
    counterpartAccountId: null,
    categoryId: 'cat-restaurants',
    type: 'depense',
    status: 'realise',
    paymentMethod: '',
    comment: '',
    recurringId: null,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
  });
  db.close();
};

describe('ouverture d’une base créée par la version précédente', () => {
  it('migre les données sans rien perdre et les enregistre', async () => {
    await createV1Database('base-v1');
    const store = new FinanceStore(
      () => new IndexedDbRepository('base-v1'),
      false,
      () => 'id',
    );
    await store.start();
    const state = store.getSnapshot();
    expect(state.status).toBe('ready');
    expect(state.dataset?.transactions.map((transaction) => transaction.id)).toEqual(['tx-perso']);
    expect(state.dataset?.yearBudgets).toEqual([{ year: '2026', planned: { 'cat-voyages': 24000 } }]);
    expect(state.dataset?.budgets[0]?.planned).toEqual({ 'cat-restaurants': 8000 });

    const reloaded = await new IndexedDbRepository('base-v1').load();
    expect(reloaded.ok && reloaded.value?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(
      reloaded.ok && reloaded.value?.categories.find((category) => category.id === 'cat-voyages')?.period,
    ).toBe('annuel');
  });
});
