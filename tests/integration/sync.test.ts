import { FinanceStore } from '@/core/store/FinanceStore';
import { DEFAULT_WORKSPACE, type Workspace } from '@/core/espaces/workspaces';
import { SCHEMA_VERSION, type Recurring } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../core/fixtures';
import { MemoryDatabase, MemoryWorkspaceRegistry } from '../support/memoryAdapters';

const commun: Workspace = { id: 'commun-ab', name: 'Commun', kind: 'commun', role: 'owner' };
const guestCommun: Workspace = { ...commun, role: 'guest' };

/** Un appareil : son store, sa liste d'espaces, sur une base partagée. */
const device = (
  db: MemoryDatabase,
  workspaces: Workspace[] = [DEFAULT_WORKSPACE, commun],
  activeId = 'perso',
) => {
  const registry = new MemoryWorkspaceRegistry({ workspaces, activeId });
  let counter = 0;
  const store = new FinanceStore(
    db.repository,
    registry,
    () => {
      counter += 1;
      return `id-${counter}-${Math.random().toString(36).slice(2, 8)}`;
    },
    () => new Date('2026-11-14T10:00:00.000Z'),
  );
  return { store, registry };
};

const seedCommun = (db: MemoryDatabase) =>
  db.write(
    commun.id,
    createInitialDataset('2026-11-01', () => 'seed', 'commun'),
    null,
  );

describe('synchronisation entre appareils', () => {
  it('affiche sans recharger une opération saisie sur un autre appareil', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store } = device(db, [DEFAULT_WORKSPACE, commun], commun.id);
    await store.start();
    db.remoteWrite(commun.id, (dataset) => ({
      ...dataset,
      transactions: [aTransaction({ id: 'courses', date: '2026-11-03', amount: -4200 })],
    }));
    expect(store.getSnapshot().dataset?.transactions.map((item) => item.id)).toEqual(['courses']);
  });

  it('n’écoute que l’espace affiché, et plus rien après l’arrêt', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store, registry } = device(db);
    await store.start();
    expect(db.listenerCount('perso')).toBe(1);
    await store.switchWorkspace(commun.id);
    expect(db.listenerCount('perso')).toBe(0);
    expect(db.listenerCount(commun.id)).toBe(1);
    store.stop();
    expect(db.listenerCount(commun.id)).toBe(0);
    expect(registry.listenerCount).toBe(0);
    expect(store.getSnapshot()).toMatchObject({ status: 'loading', dataset: null });
  });

  it('bloque un espace écrit par une version plus récente de l’application', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store } = device(db, [DEFAULT_WORKSPACE, commun], commun.id);
    await store.start();
    db.remoteWrite(commun.id, (dataset) => ({ ...dataset, schemaVersion: SCHEMA_VERSION + 1 }));
    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      error: { code: 'workspace-schema-too-recent' },
    });
  });

  it('refuse d’ouvrir un espace d’une version plus récente sans le réécrire', async () => {
    const db = new MemoryDatabase();
    db.write(
      'perso',
      { ...createInitialDataset('2026-11-01', () => 'seed'), schemaVersion: SCHEMA_VERSION + 1 },
      null,
    );
    const { store } = device(db);
    await store.start();
    expect(store.getSnapshot().error?.code).toBe('workspace-schema-too-recent');
    expect(db.read('perso')?.schemaVersion).toBe(SCHEMA_VERSION + 1);
  });

  it('ne génère pas deux fois une récurrence quand les deux appareils l’ouvrent', async () => {
    const db = new MemoryDatabase();
    const loyer: Recurring = {
      id: 'r-loyer',
      label: 'Loyer',
      amount: -90000,
      type: 'depense',
      categoryId: null,
      accountId: 'acc-courant',
      counterpartAccountId: null,
      dayOfMonth: 5,
      startMonth: '2026-11',
      endMonth: null,
      active: true,
    };
    db.write(
      commun.id,
      { ...createInitialDataset('2026-11-01', () => 'seed', 'commun'), recurrings: [loyer] },
      null,
    );
    const a = device(db, [DEFAULT_WORKSPACE, commun], commun.id);
    const b = device(db, [DEFAULT_WORKSPACE, guestCommun], commun.id);
    // Les deux appareils chargent l'espace avant de voir l'écriture de l'autre.
    const [loadedA, loadedB] = await Promise.all([a.store.start(), b.store.start()]);
    void loadedA;
    void loadedB;
    const generated = db.read(commun.id)?.transactions.filter((item) => item.recurringId === 'r-loyer');
    expect(generated?.map((item) => item.id)).toEqual(['rec-r-loyer-2026-11']);
  });
});

describe('liste des espaces partagée', () => {
  it('ajoute l’espace commun rejoint depuis un autre appareil', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [DEFAULT_WORKSPACE]);
    await store.start();
    registry.remoteChange([DEFAULT_WORKSPACE, guestCommun]);
    expect(store.getSnapshot().workspaces.map((item) => item.id)).toEqual(['perso', commun.id]);
  });

  it('revient sur l’espace principal quand l’accès à l’espace affiché est retiré', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store, registry } = device(db, [DEFAULT_WORKSPACE, guestCommun], commun.id);
    await store.start();
    registry.remoteChange([DEFAULT_WORKSPACE]);
    await vi.waitFor(() => expect(store.getSnapshot().workspace.id).toBe('perso'));
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(store.getSnapshot().dataset?.settings.kind).toBe('perso');
    expect(db.listenerCount(commun.id)).toBe(0);
  });

  it('garde toujours l’espace principal en tête, même absent de la liste reçue', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [DEFAULT_WORKSPACE]);
    await store.start();
    registry.remoteChange([guestCommun]);
    expect(store.getSnapshot().workspaces.map((item) => item.id)).toEqual(['perso', commun.id]);
  });
});

describe('gestion des espaces', () => {
  it('crée un espace commun avec la configuration d’un commun', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [DEFAULT_WORKSPACE]);
    await store.start();
    expect(await store.createWorkspace('Maison', 'commun')).toEqual({ ok: true, value: undefined });
    const created = registry.state.workspaces.find((item) => item.name === 'Maison');
    expect(created).toMatchObject({ kind: 'commun', role: 'owner' });
    expect(store.getSnapshot().workspace.id).toBe(created?.id);
    expect(store.getSnapshot().dataset?.settings.kind).toBe('commun');
    expect(db.read(created!.id)?.settings.kind).toBe('commun');
  });

  it('réserve la suppression au propriétaire', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store } = device(db, [DEFAULT_WORKSPACE, guestCommun]);
    await store.start();
    expect(await store.deleteWorkspace(commun.id)).toEqual({
      ok: false,
      error: { code: 'workspace-not-owner' },
    });
    expect(db.read(commun.id)).toBeDefined();
  });

  it('restaure une sauvegarde : espaces recréés à son nom, ceux de l’invité conservés', async () => {
    const db = new MemoryDatabase();
    const maison: Workspace = { id: 'maison-cd', name: 'Maison', kind: 'commun', role: 'guest' };
    const ancien: Workspace = { id: 'ancien', name: 'Ancien', kind: 'perso', role: 'owner' };
    db.write(
      maison.id,
      createInitialDataset('2026-11-01', () => 'seed', 'commun'),
      null,
    );
    db.write(
      ancien.id,
      createInitialDataset('2026-11-01', () => 'seed'),
      null,
    );
    const { store, registry } = device(db, [DEFAULT_WORKSPACE, maison, ancien]);
    await store.start();
    const perso = {
      ...createInitialDataset('2026-11-01', () => 'seed'),
      transactions: [aTransaction({ id: 'salaire', date: '2026-11-02', amount: 250000, type: 'revenu' })],
    };
    const communData = createInitialDataset('2026-11-01', () => 'seed', 'commun');
    const restored = await store.restoreAll(
      [
        { workspace: DEFAULT_WORKSPACE, dataset: perso },
        { workspace: { ...commun, role: 'owner' }, dataset: communData },
      ],
      commun.id,
    );
    expect(restored.ok).toBe(true);
    expect(registry.state.workspaces.map((item) => item.id).sort()).toEqual([
      'commun-ab',
      'maison-cd',
      'perso',
    ]);
    expect(registry.state.workspaces.find((item) => item.id === commun.id)?.role).toBe('owner');
    expect(db.read('perso')?.transactions.map((item) => item.id)).toEqual(['salaire']);
    expect(db.read(commun.id)?.settings.kind).toBe('commun');
    expect(db.read(ancien.id)).toBeUndefined();
    expect(db.read(maison.id)).toBeDefined();
    expect(store.getSnapshot().workspace.id).toBe(commun.id);
  });
});
