import 'fake-indexeddb/auto';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { MemoryWorkspaceRegistry } from '@/adapters/storage/workspaceRegistry';
import { FinanceStore } from '@/core/store/FinanceStore';
import { fail, ok, type Result } from '@/core/errors';
import type { FinanceRepositoryInterface, WorkspaceRegistryInterface } from '@/core/ports';
import type { Workspace } from '@/core/workspaces';
import { aTransaction } from '../core/fixtures';

let suite = 0;

class FailingRegistry implements WorkspaceRegistryInterface {
  #inner = new MemoryWorkspaceRegistry();
  failing = false;

  load() {
    return this.#inner.load();
  }

  save(workspaces: Workspace[], activeId: string): Result<void> {
    if (this.failing) {
      return fail('storage-full');
    }
    return this.#inner.save(workspaces, activeId);
  }
}

const failingPuts = (
  repository: FinanceRepositoryInterface,
  collections: string[],
): FinanceRepositoryInterface => ({
  load: () => repository.load(),
  saveSettings: (settings) => repository.saveSettings(settings),
  put: async (collection, items) =>
    collections.includes(collection) ? fail('storage-full') : repository.put(collection, items),
  remove: (collection, keys) => repository.remove(collection, keys),
  replaceAll: (dataset) => repository.replaceAll(dataset),
  destroy: () => repository.destroy(),
  close: () => repository.close(),
});

const setup = (options: { failingCollections?: string[]; failingDestroy?: boolean } = {}) => {
  suite += 1;
  const registry = new FailingRegistry();
  let counter = 0;
  const store = new FinanceStore(
    (workspaceId) => {
      const real = new IndexedDbRepository(`erreurs-${suite}-${workspaceId}`);
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
    expect(store.renameWorkspace('perso', 'Cyril')).toEqual({ ok: false, error: { code: 'storage-full' } });
    expect(store.markShared('perso')).toEqual({ ok: false, error: { code: 'storage-full' } });
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
