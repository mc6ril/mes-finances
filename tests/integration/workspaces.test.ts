import { FinanceStore } from '@/core/store/FinanceStore';
import type { Category, Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../core/fixtures';
import { MemoryDatabase, MemoryWorkspaceRegistry } from '../support/memoryAdapters';

const setup = () => {
  const db = new MemoryDatabase();
  const registry = new MemoryWorkspaceRegistry();
  let counter = 0;
  let ticks = -1;
  const store = new FinanceStore(
    db.repository,
    registry,
    () => {
      counter += 1;
      return `id-${counter}`;
    },
    () => {
      ticks += 1;
      return new Date(Date.UTC(2026, 10, 8, 10, 0, ticks));
    },
  );
  return { store, registry, db };
};

const communFile = (): Dataset => ({
  ...createInitialDataset('2026-11-01', () => 'audit'),
  transactions: [
    aTransaction({ id: 'courses', date: '2026-11-03', amount: -8000, accountId: 'acc-courant' }),
  ],
});

const archived = (categories: Category[], id: string) =>
  categories.find((category) => category.id === id)?.archived;

describe('espaces de suivi', () => {
  it('ouvre par défaut l’espace principal', async () => {
    const { store } = setup();
    await store.start();
    expect(store.getSnapshot().workspace.id).toBe('perso');
    expect(store.getSnapshot().dataset?.transactions).toEqual([]);
  });

  it('garde des catégories et réglages indépendants d’un espace à l’autre', async () => {
    const { store } = setup();
    await store.start();
    const divers = store.getSnapshot().dataset?.categories.find((category) => category.id === 'cat-divers');
    await store.upsert('categories', [{ ...divers!, archived: true }], {
      action: 'modification',
      entity: 'Catégorie',
      summary: 'Divers archivée',
    });
    await store.createWorkspace('Commun');
    expect(store.getSnapshot().workspace.name).toBe('Commun');
    expect(archived(store.getSnapshot().dataset?.categories ?? [], 'cat-divers')).toBe(false);
    await store.switchWorkspace('perso');
    expect(archived(store.getSnapshot().dataset?.categories ?? [], 'cat-divers')).toBe(true);
  });

  it('crée un espace commun avec ses propres réglages', async () => {
    const { store } = setup();
    await store.start();
    expect((await store.createWorkspace('Commun', 'commun')).ok).toBe(true);
    expect(store.getSnapshot().dataset?.settings.kind).toBe('commun');
    await store.switchWorkspace('perso');
    expect(store.getSnapshot().dataset?.settings.kind).toBe('perso');
  });

  it('supprime un espace et revient sur l’espace principal', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun', 'commun');
    const communId = store.getSnapshot().workspace.id;
    expect((await store.deleteWorkspace(communId)).ok).toBe(true);
    expect(store.getSnapshot().workspace.id).toBe('perso');
    expect(store.getSnapshot().workspaces.map((workspace) => workspace.id)).toEqual(['perso']);
    expect((await store.deleteWorkspace('perso')).ok).toBe(false);
  });

  it('renomme un espace en refusant les doublons', async () => {
    const { store, registry } = setup();
    await store.start();
    await store.createWorkspace('Commun');
    expect((await store.renameWorkspace('perso', 'commun')).ok).toBe(false);
    expect((await store.renameWorkspace('perso', 'Jean D.')).ok).toBe(true);
    expect(store.getSnapshot().workspaces[0]?.name).toBe('Jean D.');
    expect(registry.state.workspaces[0]?.name).toBe('Jean D.');
  });

  it('sauvegarde tous les espaces puis les restaure, en supprimant ceux absents du fichier', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun', 'commun');
    const communId = store.getSnapshot().workspace.id;
    await store.restore(communFile(), { action: 'restauration', entity: 'Test', summary: 'Commun' });
    const saved = await store.allWorkspaceData();
    expect(saved.ok && saved.value.map((entry) => entry.workspace.name)).toEqual(['Perso', 'Commun']);
    await store.createWorkspace('Brouillon');
    if (!saved.ok) {
      throw new Error('sauvegarde impossible');
    }
    expect((await store.restoreAll(saved.value, communId)).ok).toBe(true);
    const { workspaces, workspace, dataset } = store.getSnapshot();
    expect(workspaces.map((item) => item.name)).toEqual(['Perso', 'Commun']);
    expect(workspace).toMatchObject({ id: communId, kind: 'commun', role: 'owner' });
    expect(dataset?.transactions.map((transaction) => transaction.id)).toEqual(['courses']);
  });

  it('génère les récurrences à l’ouverture sans doubler une saisie manuelle', async () => {
    const { store } = setup();
    await store.start();
    const recurring = {
      id: 'r-mobile',
      label: 'Forfait mobile',
      amount: -799,
      type: 'depense' as const,
      categoryId: 'cat-telephone',
      accountId: 'acc-courant',
      counterpartAccountId: null,
      dayOfMonth: 5,
      startMonth: '2026-11',
      endMonth: null,
      active: true,
    };
    await store.upsert(
      'transactions',
      [aTransaction({ id: 'manuel', date: '2026-11-05', amount: -799, accountId: 'acc-courant' })],
      {
        action: 'creation',
        entity: 'Opération',
        summary: 'Forfait',
      },
    );
    await store.upsert('recurrings', [recurring], {
      action: 'creation',
      entity: 'Récurrence',
      summary: 'Forfait',
    });
    const mobiles = () =>
      (store.getSnapshot().dataset?.transactions ?? []).filter((transaction) => transaction.amount === -799);
    expect(mobiles().map((transaction) => [transaction.id, transaction.recurringId])).toEqual([
      ['manuel', 'r-mobile'],
    ]);
    await store.remove('transactions', ['manuel'], {
      action: 'suppression',
      entity: 'Opération',
      summary: 'Forfait',
    });
    await store.refresh();
    expect(mobiles()).toEqual([]);
  });
});
