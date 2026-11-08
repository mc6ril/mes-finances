import 'fake-indexeddb/auto';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { MemoryWorkspaceRegistry } from '@/adapters/storage/workspaceRegistry';
import { FinanceStore } from '@/core/store/FinanceStore';
import type { Category, Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { hasUnsentChanges } from '@/core/espaces/workspaces';
import { aTransaction } from '../core/fixtures';

let suite = 0;

const setup = () => {
  suite += 1;
  const prefix = `espaces-${suite}`;
  const registry = new MemoryWorkspaceRegistry();
  let counter = 0;
  let ticks = -1;
  const store = new FinanceStore(
    (workspaceId) => new IndexedDbRepository(`${prefix}-${workspaceId}`),
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
  return { store, registry };
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

  it('importe un espace partagé modifiable, sans toucher à l’espace principal', async () => {
    const { store, registry } = setup();
    await store.start();
    const result = await store.importWorkspace(communFile(), { kind: 'new', name: 'Commun' });
    expect(result.ok).toBe(true);
    const { workspace, dataset } = store.getSnapshot();
    expect(workspace).toMatchObject({
      name: 'Commun',
      source: 'import',
      importedAt: expect.stringMatching(/^2026-11-08T10:00/),
    });
    expect(dataset?.transactions.map((transaction) => transaction.id)).toEqual(['courses']);
    expect(registry.state.activeId).toBe(workspace.id);
    expect(hasUnsentChanges(workspace)).toBe(false);
    const write = await store.upsert('transactions', [aTransaction({ id: 'ajout' })], {
      action: 'creation',
      entity: 'Opération',
      summary: 'Ajout',
    });
    expect(write.ok).toBe(true);
    expect(hasUnsentChanges(store.getSnapshot().workspace)).toBe(true);
    store.markShared(workspace.id);
    expect(hasUnsentChanges(store.getSnapshot().workspace)).toBe(false);
    await store.switchWorkspace('perso');
    expect(store.getSnapshot().dataset?.transactions).toEqual([]);
  });

  it('remplace un espace importé lors d’un nouvel import', async () => {
    const { store } = setup();
    await store.start();
    await store.importWorkspace(communFile(), { kind: 'new', name: 'Commun' });
    const communId = store.getSnapshot().workspace.id;
    await store.switchWorkspace('perso');
    const update = {
      ...communFile(),
      transactions: [
        aTransaction({ id: 'loyer', date: '2026-12-01', amount: -90000, accountId: 'acc-courant' }),
      ],
    };
    await store.importWorkspace(update, { kind: 'existing', workspaceId: communId });
    expect(store.getSnapshot().workspace.id).toBe(communId);
    expect(store.getSnapshot().workspaces).toHaveLength(2);
    expect(store.getSnapshot().dataset?.transactions.map((transaction) => transaction.id)).toEqual(['loyer']);
  });

  it('refuse de remplacer l’espace principal par un import', async () => {
    const { store } = setup();
    await store.start();
    expect(
      await store.importWorkspace(communFile(), { kind: 'existing', workspaceId: 'perso' }),
    ).toMatchObject({
      ok: false,
    });
  });

  it('supprime un espace et revient sur l’espace principal', async () => {
    const { store } = setup();
    await store.start();
    await store.importWorkspace(communFile(), { kind: 'new', name: 'Commun' });
    const communId = store.getSnapshot().workspace.id;
    expect((await store.deleteWorkspace(communId)).ok).toBe(true);
    expect(store.getSnapshot().workspace.id).toBe('perso');
    expect(store.getSnapshot().workspaces.map((workspace) => workspace.id)).toEqual(['perso']);
    expect((await store.deleteWorkspace('perso')).ok).toBe(false);
  });

  it('renomme un espace en refusant les doublons', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun');
    expect(store.renameWorkspace('perso', 'commun').ok).toBe(false);
    expect(store.renameWorkspace('perso', 'Cyril').ok).toBe(true);
    expect(store.getSnapshot().workspaces[0]?.name).toBe('Cyril');
  });

  it('sauvegarde tous les espaces puis les restaure, en supprimant ceux absents du fichier', async () => {
    const { store } = setup();
    await store.start();
    await store.importWorkspace(communFile(), { kind: 'new', name: 'Commun' });
    const communId = store.getSnapshot().workspace.id;
    const saved = await store.allWorkspaceData();
    expect(saved.ok && saved.value.map((entry) => entry.workspace.name)).toEqual(['Perso', 'Commun']);
    await store.createWorkspace('Brouillon');
    if (!saved.ok) {
      throw new Error('sauvegarde impossible');
    }
    expect((await store.restoreAll(saved.value, communId)).ok).toBe(true);
    const { workspaces, workspace, dataset } = store.getSnapshot();
    expect(workspaces.map((item) => item.name)).toEqual(['Perso', 'Commun']);
    expect(workspace).toMatchObject({ id: communId, source: 'import' });
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

  it('met à jour un espace créé localement avec le fichier reçu, qui devient partagé', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun');
    const communId = store.getSnapshot().workspace.id;
    await store.switchWorkspace('perso');
    expect((await store.importWorkspace(communFile(), { kind: 'existing', workspaceId: communId })).ok).toBe(
      true,
    );
    expect(store.getSnapshot().workspace).toMatchObject({ id: communId, source: 'import', modifiedAt: null });
    expect(store.getSnapshot().dataset?.transactions.map((transaction) => transaction.id)).toEqual([
      'courses',
    ]);
  });

  it('ne compte pas la génération automatique comme une modification à envoyer', async () => {
    const { store } = setup();
    await store.start();
    const file = {
      ...communFile(),
      recurrings: [
        {
          id: 'r-loyer',
          label: 'Loyer',
          amount: -90000,
          type: 'depense' as const,
          categoryId: null,
          accountId: 'acc-courant',
          counterpartAccountId: null,
          dayOfMonth: 1,
          startMonth: '2026-11',
          endMonth: null,
          active: true,
        },
      ],
    };
    await store.importWorkspace(file, { kind: 'new', name: 'Commun' });
    expect(
      store.getSnapshot().dataset?.transactions.some((transaction) => transaction.recurringId === 'r-loyer'),
    ).toBe(true);
    expect(hasUnsentChanges(store.getSnapshot().workspace)).toBe(false);
  });
});
