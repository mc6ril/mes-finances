import type { Workspace } from '@/core/espaces/workspaces';
import { SCHEMA_VERSION } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { FinanceStore } from '@/core/store/FinanceStore';
import { aTransaction } from '../core/fixtures';
import { MemoryDatabase, MemoryWorkspaceRegistry, TEST_MAIN } from '../support/memoryAdapters';

const commun: Workspace = { id: 'commun-ab', name: 'Commun', kind: 'commun', role: 'owner' };
const guestCommun: Workspace = { ...commun, role: 'guest' };

/** Un appareil : son store, sa liste d'espaces, sur une base partagée. */
const device = (
  db: MemoryDatabase,
  workspaces: Workspace[] = [TEST_MAIN, commun],
  activeId = TEST_MAIN.id,
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
    const { store } = device(db, [TEST_MAIN, commun], commun.id);
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
    expect(db.listenerCount(TEST_MAIN.id)).toBe(1);
    await store.switchWorkspace(commun.id);
    expect(db.listenerCount(TEST_MAIN.id)).toBe(0);
    expect(db.listenerCount(commun.id)).toBe(1);
    store.stop();
    expect(db.listenerCount(commun.id)).toBe(0);
    expect(registry.listenerCount).toBe(0);
    expect(store.getSnapshot()).toMatchObject({ status: 'loading', dataset: null });
  });

  it('bloque un espace écrit par une version plus récente de l’application', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store } = device(db, [TEST_MAIN, commun], commun.id);
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
      TEST_MAIN.id,
      { ...createInitialDataset('2026-11-01', () => 'seed'), schemaVersion: SCHEMA_VERSION + 1 },
      null,
    );
    const { store } = device(db);
    await store.start();
    expect(store.getSnapshot().error?.code).toBe('workspace-schema-too-recent');
    expect(db.read(TEST_MAIN.id)?.schemaVersion).toBe(SCHEMA_VERSION + 1);
  });

  it('migre un espace d’une version précédente et l’enregistre dans la version courante', async () => {
    const db = new MemoryDatabase();
    db.write(
      TEST_MAIN.id,
      { ...createInitialDataset('2026-11-01', () => 'seed'), schemaVersion: SCHEMA_VERSION - 1 },
      null,
    );
    const { store } = device(db);
    await store.start();
    expect(store.getSnapshot().status).toBe('ready');
    expect(db.read(TEST_MAIN.id)?.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('liste des espaces partagée', () => {
  it('ajoute l’espace commun rejoint depuis un autre appareil', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [TEST_MAIN]);
    await store.start();
    registry.remoteChange([TEST_MAIN, guestCommun]);
    expect(store.getSnapshot().workspaces.map((item) => item.id)).toEqual([TEST_MAIN.id, commun.id]);
  });

  it('revient sur l’espace principal quand l’accès à l’espace affiché est retiré', async () => {
    const db = new MemoryDatabase();
    seedCommun(db);
    const { store, registry } = device(db, [TEST_MAIN, guestCommun], commun.id);
    await store.start();
    registry.remoteChange([TEST_MAIN]);
    await vi.waitFor(() => expect(store.getSnapshot().workspace.id).toBe(TEST_MAIN.id));
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(store.getSnapshot().dataset?.settings.kind).toBe('perso');
    expect(db.listenerCount(commun.id)).toBe(0);
  });

  it('garde un espace tout juste créé malgré une liste reçue en retard qui ne le contient pas encore', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [TEST_MAIN]);
    await store.start();
    await store.createWorkspace('Maison', 'commun');
    const created = store.getSnapshot().workspace;
    expect(created.name).toBe('Maison');
    registry.remoteChange([TEST_MAIN]);
    await Promise.resolve();
    expect(store.getSnapshot().workspace.id).toBe(created.id);
    expect(store.getSnapshot().workspaces.map((item) => item.id)).toContain(created.id);
    // Une fois confirmé par le serveur, son retrait ultérieur est bien pris en compte.
    registry.remoteChange([TEST_MAIN, created]);
    registry.remoteChange([TEST_MAIN]);
    await vi.waitFor(() => expect(store.getSnapshot().workspace.id).toBe(TEST_MAIN.id));
  });

  it('garde toujours l’espace principal en tête, même absent de la liste reçue', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [TEST_MAIN]);
    await store.start();
    registry.remoteChange([guestCommun]);
    expect(store.getSnapshot().workspaces.map((item) => item.id)).toEqual([TEST_MAIN.id, commun.id]);
  });
});

describe('gestion des espaces', () => {
  it('crée un espace commun avec la configuration d’un commun', async () => {
    const db = new MemoryDatabase();
    const { store, registry } = device(db, [TEST_MAIN]);
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
    const { store } = device(db, [TEST_MAIN, guestCommun]);
    await store.start();
    expect(await store.deleteWorkspace(commun.id)).toEqual({
      ok: false,
      error: { code: 'workspace-not-owner' },
    });
    expect(db.read(commun.id)).toBeDefined();
  });

  it('restaure une sauvegarde : commun non partagé copié à son nom, espaces absents du fichier conservés', async () => {
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
    const { store, registry } = device(db, [TEST_MAIN, maison, ancien]);
    await store.start();
    const perso = {
      ...createInitialDataset('2026-11-01', () => 'seed'),
      transactions: [aTransaction({ id: 'salaire', date: '2026-11-02', amount: 250000, type: 'revenu' })],
    };
    const communData = createInitialDataset('2026-11-01', () => 'seed', 'commun');
    const restored = await store.restoreAll(
      [
        { workspace: TEST_MAIN, dataset: perso },
        { workspace: { ...commun, role: 'owner' }, dataset: communData },
      ],
      commun.id,
    );
    expect(restored.ok).toBe(true);
    // Le commun du fichier n'est pas dans la liste : il devient une copie à soi, sous un nouvel id.
    const copy = registry.state.workspaces.find((item) => item.name === commun.name);
    expect(copy).toMatchObject({ kind: 'commun', role: 'owner' });
    expect(copy?.id).not.toBe(commun.id);
    expect(registry.state.workspaces.map((item) => item.id).sort()).toEqual(
      ['ancien', copy?.id, 'maison-cd', TEST_MAIN.id].sort(),
    );
    expect(db.read(TEST_MAIN.id)?.transactions.map((item) => item.id)).toEqual(['salaire']);
    expect(db.read(copy?.id ?? '')?.settings.kind).toBe('commun');
    expect(db.read(commun.id)).toBeUndefined();
    expect(db.read(ancien.id)).toBeDefined();
    expect(db.read(maison.id)).toBeDefined();
    expect(store.getSnapshot().workspace.id).toBe(copy?.id);
  });
});
