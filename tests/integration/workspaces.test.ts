import type { Category, Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { FinanceStore } from '@/core/store/FinanceStore';
import { aTransaction } from '../core/fixtures';
import { MemoryDatabase, MemoryWorkspaceRegistry, TEST_MAIN } from '../support/memoryAdapters';

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
    expect(store.getSnapshot().workspace.id).toBe(TEST_MAIN.id);
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
    await store.switchWorkspace(TEST_MAIN.id);
    expect(archived(store.getSnapshot().dataset?.categories ?? [], 'cat-divers')).toBe(true);
  });

  it('crée un espace commun avec ses propres réglages', async () => {
    const { store } = setup();
    await store.start();
    expect((await store.createWorkspace('Commun', 'commun')).ok).toBe(true);
    expect(store.getSnapshot().dataset?.settings.kind).toBe('commun');
    await store.switchWorkspace(TEST_MAIN.id);
    expect(store.getSnapshot().dataset?.settings.kind).toBe('perso');
  });

  it('supprime un espace et revient sur l’espace principal', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun', 'commun');
    const communId = store.getSnapshot().workspace.id;
    expect((await store.deleteWorkspace(communId)).ok).toBe(true);
    expect(store.getSnapshot().workspace.id).toBe(TEST_MAIN.id);
    expect(store.getSnapshot().workspaces.map((workspace) => workspace.id)).toEqual([TEST_MAIN.id]);
    expect((await store.deleteWorkspace(TEST_MAIN.id)).ok).toBe(false);
  });

  it('renomme un espace en refusant les doublons', async () => {
    const { store, registry } = setup();
    await store.start();
    await store.createWorkspace('Commun');
    expect((await store.renameWorkspace(TEST_MAIN.id, 'commun')).ok).toBe(false);
    expect((await store.renameWorkspace(TEST_MAIN.id, 'Jean D.')).ok).toBe(true);
    expect(store.getSnapshot().workspaces[0]?.name).toBe('Jean D.');
    expect(registry.state.workspaces[0]?.name).toBe('Jean D.');
  });

  it('sauvegarde tous les espaces puis les restaure, sans toucher à ceux absents du fichier', async () => {
    const { store } = setup();
    await store.start();
    await store.createWorkspace('Commun', 'commun');
    const communId = store.getSnapshot().workspace.id;
    await store.restore(communFile(), { action: 'restauration', entity: 'Test', summary: 'Commun' });
    const saved = await store.allWorkspaceData();
    expect(saved.ok && saved.value.map((entry) => entry.workspace.name)).toEqual(['Mon espace', 'Commun']);
    await store.createWorkspace('Brouillon');
    if (!saved.ok) {
      throw new Error('sauvegarde impossible');
    }
    expect((await store.restoreAll(saved.value, communId)).ok).toBe(true);
    const { workspaces, workspace, dataset } = store.getSnapshot();
    expect(workspaces.map((item) => item.name)).toEqual(['Mon espace', 'Brouillon', 'Commun']);
    expect(workspace).toMatchObject({ id: communId, kind: 'commun', role: 'owner' });
    expect(dataset?.transactions.map((transaction) => transaction.id)).toEqual(['courses']);
  });

  it('restaure chez soi la sauvegarde d’un autre compte, sans toucher à ses espaces', async () => {
    const { store, db } = setup();
    await store.start();
    await store.createWorkspace('Commun', 'commun');
    const mine = store.getSnapshot().workspace.id;
    const backupOfA = [
      {
        workspace: { id: 'perso-uid-001', name: 'Perso', kind: 'perso' as const, role: 'owner' as const },
        dataset: communFile(),
      },
      {
        workspace: { id: 'commun-a', name: 'Commun', kind: 'commun' as const, role: 'owner' as const },
        dataset: { ...communFile(), settings: { ...communFile().settings, kind: 'commun' as const } },
      },
    ];
    expect(await store.restoreAll(backupOfA, 'commun-a')).toEqual({ ok: true, value: undefined });
    const { workspaces, workspace } = store.getSnapshot();
    expect(workspaces.map((item) => item.name)).toEqual(['Mon espace', 'Commun', 'Commun (restauré)']);
    expect(workspace).toMatchObject({ name: 'Commun (restauré)', kind: 'commun', role: 'owner' });
    expect(workspace.id).not.toBe('commun-a');
    expect(db.read(TEST_MAIN.id)?.transactions.map((item) => item.id)).toEqual(['courses']);
    expect(db.read(workspace.id)?.transactions.map((item) => item.id)).toEqual(['courses']);
    expect(db.read(mine)?.transactions).toEqual([]);
    expect(db.read('perso-uid-001')).toBeUndefined();
    expect(db.read('commun-a')).toBeUndefined();
  });

  it('ne restaure rien si la création des copies est refusée', async () => {
    const { store, registry, db } = setup();
    await store.start();
    const before = { main: db.read(TEST_MAIN.id), workspaces: store.getSnapshot().workspaces };
    registry.createAll = async () => ({ ok: false, error: { code: 'sync-permission-denied' } });
    const backup = [
      {
        workspace: { id: 'perso-uid-001', name: 'Perso', kind: 'perso' as const, role: 'owner' as const },
        dataset: communFile(),
      },
      {
        workspace: { id: 'commun-a', name: 'Commun', kind: 'commun' as const, role: 'owner' as const },
        dataset: communFile(),
      },
    ];
    expect(await store.restoreAll(backup, 'commun-a')).toEqual({
      ok: false,
      error: { code: 'sync-permission-denied' },
    });
    expect(db.read(TEST_MAIN.id)).toEqual(before.main);
    expect(store.getSnapshot().workspaces).toEqual(before.workspaces);
  });
});
