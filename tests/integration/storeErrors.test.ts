import { FinanceStore } from '@/core/store/FinanceStore';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { FinanceRepositoryInterface } from '@/core/store/interface';
import type { WorkspaceRegistryInterface, WorkspacesListener } from '@/core/espaces/interface';
import type { Workspace } from '@/core/espaces/workspaces';
import { aTransaction } from '../core/fixtures';
import { MemoryDatabase, MemoryWorkspaceRegistry } from '../support/memoryAdapters';

class FailingRegistry implements WorkspaceRegistryInterface {
  #inner = new MemoryWorkspaceRegistry();
  failing = false;
  failingLoad = false;

  async load() {
    return this.failingLoad ? fail('storage-unavailable') : this.#inner.load();
  }

  watch(listener: WorkspacesListener) {
    return this.#inner.watch(listener);
  }

  async #attempt(task: () => Promise<Result<void>>): Promise<Result<void>> {
    return this.failing ? fail('storage-full') : task();
  }

  create(workspace: Workspace) {
    return this.#attempt(() => this.#inner.create(workspace));
  }

  rename(workspaceId: string, name: string) {
    return this.#attempt(() => this.#inner.rename(workspaceId, name));
  }

  remove(workspaceId: string) {
    return this.#attempt(() => this.#inner.remove(workspaceId));
  }

  setActive(workspaceId: string) {
    return this.#inner.setActive(workspaceId);
  }
}

const failingPuts = (
  repository: FinanceRepositoryInterface,
  collections: string[],
): FinanceRepositoryInterface => ({
  load: () => repository.load(),
  watch: (listener) => repository.watch(listener),
  saveSettings: (settings) => repository.saveSettings(settings),
  put: async (collection, items) =>
    collections.includes(collection) ? fail('storage-full') : repository.put(collection, items),
  remove: (collection, keys) => repository.remove(collection, keys),
  replaceAll: (dataset) => repository.replaceAll(dataset),
  destroy: () => repository.destroy(),
  close: () => repository.close(),
});

const setup = (options: { failingCollections?: string[]; failingDestroy?: boolean } = {}) => {
  const db = new MemoryDatabase();
  const registry = new FailingRegistry();
  let counter = 0;
  const store = new FinanceStore(
    (workspaceId) => {
      const real = db.repository(workspaceId);
      const repository = failingPuts(real, options.failingCollections ?? []);
      return options.failingDestroy && workspaceId !== 'perso'
        ? { ...repository, destroy: async () => fail('storage-failed') }
        : repository;
    },
    registry,
    () => {
      counter += 1;
      return `id-${counter}`;
    },
    () => new Date('2026-11-08T10:00:00.000Z'),
  );
  return { store, registry };
};

const mobile = {
  id: 'r-mobile',
  label: 'Forfait mobile',
  amount: -799,
  type: 'depense' as const,
  categoryId: null,
  accountId: 'acc-courant',
  counterpartAccountId: null,
  dayOfMonth: 5,
  startMonth: '2026-11',
  endMonth: null,
  active: true,
};

describe('erreurs du store', () => {
  it('fait remonter l’échec d’enregistrement de la liste des espaces', async () => {
    const { store, registry } = setup();
    await store.start();
    registry.failing = true;
    expect(await store.createWorkspace('Commun')).toEqual({ ok: false, error: { code: 'storage-full' } });
    expect(store.getSnapshot().workspaces.map((workspace) => workspace.name)).toEqual(['Perso']);
    expect(await store.renameWorkspace('perso', 'Jean D.')).toEqual({
      ok: false,
      error: { code: 'storage-full' },
    });
    expect(store.getSnapshot().workspaces[0]?.name).toBe('Perso');
  });

  it('affiche l’échec du chargement de la liste des espaces', async () => {
    const { store, registry } = setup();
    registry.failingLoad = true;
    await store.start();
    expect(store.getSnapshot()).toMatchObject({ status: 'error', error: { code: 'storage-unavailable' } });
  });

  it('signale l’échec de la génération automatique au lieu de l’ignorer', async () => {
    const { store } = setup({ failingCollections: ['recurrings'] });
    await store.start();
    const saved = await store.upsert('recurrings', [mobile], {
      action: 'creation',
      entity: 'Récurrence',
      summary: 'Forfait',
    });
    expect(saved).toEqual({ ok: false, error: { code: 'storage-full' } });
  });

  it('expose l’échec d’un rafraîchissement en arrière-plan', async () => {
    const { store } = setup({ failingCollections: ['transactions'] });
    await store.start();
    await store.restore(
      {
        ...store.getSnapshot().dataset!,
        transactions: [
          aTransaction({ id: 'du', date: '2026-11-02', status: 'prevu', accountId: 'acc-courant' }),
        ],
      },
      { action: 'restauration', entity: 'Test', summary: 'test' },
    );
    expect(await store.refresh()).toEqual({ ok: false, error: { code: 'storage-full' } });
    expect(store.getSnapshot().syncError).toEqual({ code: 'storage-full' });
  });

  it('fait remonter l’échec de suppression d’un espace absent de la sauvegarde complète', async () => {
    const { store } = setup({ failingDestroy: true });
    await store.start();
    await store.createWorkspace('Brouillon');
    const saved = await store.allWorkspaceData();
    const perso = saved.ok ? saved.value.filter((entry) => entry.workspace.id === 'perso') : [];
    expect(await store.restoreAll(perso, 'perso')).toEqual({ ok: false, error: { code: 'storage-failed' } });
  });

  it('confirme le succès quand tout va bien', async () => {
    const { store } = setup();
    await store.start();
    expect(await store.refresh()).toEqual(ok(undefined));
    expect(store.getSnapshot().syncError).toBeNull();
  });
});
