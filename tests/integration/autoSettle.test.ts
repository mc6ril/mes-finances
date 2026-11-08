import 'fake-indexeddb/auto';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { MemoryWorkspaceRegistry } from '@/adapters/storage/workspaceRegistry';
import { FinanceStore } from '@/core/store/FinanceStore';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../core/fixtures';

describe('bascule automatique à l’ouverture', () => {
  it('enregistre les opérations prévues échues comme réalisées', async () => {
    const repository = new IndexedDbRepository('bascule');
    const dataset = createInitialDataset('2026-11-01', () => 'audit-1');
    await repository.replaceAll({
      ...dataset,
      transactions: [
        aTransaction({ id: 'mobile', date: '2026-11-05', status: 'prevu', accountId: 'acc-courant' }),
        aTransaction({ id: 'noel', date: '2026-12-20', status: 'prevu', accountId: 'acc-courant' }),
      ],
    });
    const store = new FinanceStore(
      () => new IndexedDbRepository('bascule'),
      new MemoryWorkspaceRegistry(),
      () => 'id',
      () => new Date('2026-11-26T10:00:00'),
    );
    await store.start();
    const statuses = (transactions: { id: string; status: string }[] | undefined) =>
      Object.fromEntries((transactions ?? []).map((transaction) => [transaction.id, transaction.status]));
    expect(statuses(store.getSnapshot().dataset?.transactions)).toEqual({ mobile: 'realise', noel: 'prevu' });
    const reloaded = await new IndexedDbRepository('bascule').load();
    expect(statuses(reloaded.ok ? reloaded.value?.transactions : [])).toEqual({
      mobile: 'realise',
      noel: 'prevu',
    });
  });

  it('rebascule à la demande quand la date change pendant que l’app est ouverte', async () => {
    let current = new Date('2026-11-26T10:00:00');
    const repository = new IndexedDbRepository('bascule-2');
    await repository.replaceAll({
      ...createInitialDataset('2026-11-01', () => 'audit-1'),
      transactions: [
        aTransaction({ id: 'noel', date: '2026-12-20', status: 'prevu', accountId: 'acc-courant' }),
      ],
    });
    const store = new FinanceStore(
      () => new IndexedDbRepository('bascule-2'),
      new MemoryWorkspaceRegistry(),
      () => 'id',
      () => current,
    );
    await store.start();
    current = new Date('2026-12-21T09:00:00');
    await store.settleDue();
    expect(store.getSnapshot().dataset?.transactions[0]?.status).toBe('realise');
  });

  it('bascule tout de suite une opération prévue enregistrée avec une date passée', async () => {
    await new IndexedDbRepository('bascule-3').replaceAll(
      createInitialDataset('2026-11-01', () => 'audit-1'),
    );
    const store = new FinanceStore(
      () => new IndexedDbRepository('bascule-3'),
      new MemoryWorkspaceRegistry(),
      () => 'id',
      () => new Date('2026-11-26T10:00:00'),
    );
    await store.start();
    await store.upsert(
      'transactions',
      [aTransaction({ id: 'oubli', date: '2026-11-10', status: 'prevu', accountId: 'acc-courant' })],
      {
        action: 'creation',
        entity: 'Opération',
        summary: 'test',
      },
    );
    expect(
      store.getSnapshot().dataset?.transactions.find((transaction) => transaction.id === 'oubli')?.status,
    ).toBe('realise');
  });
});
