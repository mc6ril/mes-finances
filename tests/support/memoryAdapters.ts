import { itemKey } from '@/core/shared/collections';
import { ok, type Result } from '@/core/shared/errors';
import type { CollectionName, Dataset, Settings } from '@/core/shared/model';
import type { CollectionItem, DatasetListener, FinanceRepositoryInterface } from '@/core/store/interface';
import type { WorkspaceRegistryInterface, WorkspacesListener } from '@/core/espaces/interface';
import {
  DEFAULT_WORKSPACE,
  resolveActiveId,
  type Workspace,
  type WorkspaceRegistryState,
} from '@/core/espaces/workspaces';

/**
 * Base partagée entre plusieurs « appareils » de test : chaque dépôt créé dessus voit les écritures
 * des autres, comme une base distante synchronisée.
 */
export class MemoryDatabase {
  readonly datasets = new Map<string, Dataset>();
  readonly #listeners = new Map<string, Set<DatasetListener>>();

  repository = (workspaceId: string): FinanceRepositoryInterface => new MemoryRepository(this, workspaceId);

  read(workspaceId: string): Dataset | undefined {
    const dataset = this.datasets.get(workspaceId);
    return dataset ? structuredClone(dataset) : undefined;
  }

  write(workspaceId: string, dataset: Dataset, origin: MemoryRepository | null): void {
    this.datasets.set(workspaceId, structuredClone(dataset));
    this.#listeners.get(workspaceId)?.forEach((listener) => {
      if ((listener as { origin?: MemoryRepository }).origin !== origin) {
        listener(structuredClone(dataset));
      }
    });
  }

  /** Écriture faite sur un autre appareil. */
  remoteWrite(workspaceId: string, update: (dataset: Dataset) => Dataset): void {
    const current = this.read(workspaceId);
    if (!current) {
      throw new Error(`Espace ${workspaceId} absent`);
    }
    this.write(workspaceId, update(current), null);
  }

  drop(workspaceId: string): void {
    this.datasets.delete(workspaceId);
  }

  listen(workspaceId: string, listener: DatasetListener): () => void {
    const listeners = this.#listeners.get(workspaceId) ?? new Set<DatasetListener>();
    listeners.add(listener);
    this.#listeners.set(workspaceId, listeners);
    return () => listeners.delete(listener);
  }

  listenerCount(workspaceId: string): number {
    return this.#listeners.get(workspaceId)?.size ?? 0;
  }
}

class MemoryRepository implements FinanceRepositoryInterface {
  readonly #db: MemoryDatabase;
  readonly #workspaceId: string;

  constructor(db: MemoryDatabase, workspaceId: string) {
    this.#db = db;
    this.#workspaceId = workspaceId;
  }

  #update(change: (dataset: Dataset) => Dataset): Result<void> {
    const current = this.#db.read(this.#workspaceId);
    if (current) {
      this.#db.write(this.#workspaceId, change(current), this);
    }
    return ok(undefined);
  }

  async load(): Promise<Result<Dataset | null>> {
    return ok(this.#db.read(this.#workspaceId) ?? null);
  }

  watch(listener: DatasetListener): () => void {
    const tagged = Object.assign((dataset: Dataset) => listener(dataset), { origin: this });
    return this.#db.listen(this.#workspaceId, tagged);
  }

  async saveSettings(settings: Settings): Promise<Result<void>> {
    return this.#update((dataset) => ({ ...dataset, settings }));
  }

  async put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<Result<void>> {
    return this.#update((dataset) => {
      const keys = new Set(items.map((item) => itemKey(collection, item)));
      const kept = (dataset[collection] as object[]).filter((item) => !keys.has(itemKey(collection, item)));
      return { ...dataset, [collection]: [...kept, ...items] } as Dataset;
    });
  }

  async remove(collection: CollectionName, keys: string[]): Promise<Result<void>> {
    return this.#update((dataset) => {
      const removed = new Set(keys);
      const kept = (dataset[collection] as object[]).filter(
        (item) => !removed.has(itemKey(collection, item)),
      );
      return { ...dataset, [collection]: kept } as Dataset;
    });
  }

  async replaceAll(dataset: Dataset): Promise<Result<void>> {
    this.#db.write(this.#workspaceId, dataset, this);
    return ok(undefined);
  }

  async destroy(): Promise<Result<void>> {
    this.#db.drop(this.#workspaceId);
    return ok(undefined);
  }

  async close(): Promise<void> {
    return;
  }
}

/** Liste des espaces en mémoire, dont la liste peut changer « ailleurs » (`remoteChange`). */
export class MemoryWorkspaceRegistry implements WorkspaceRegistryInterface {
  #state: WorkspaceRegistryState;
  readonly #listeners = new Set<WorkspacesListener>();

  constructor(
    state: WorkspaceRegistryState = { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id },
  ) {
    this.#state = state;
  }

  get state(): WorkspaceRegistryState {
    return this.#state;
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }

  async load(): Promise<Result<WorkspaceRegistryState>> {
    return ok({ ...this.#state, activeId: resolveActiveId(this.#state.workspaces, this.#state.activeId) });
  }

  watch(listener: WorkspacesListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async create(workspace: Workspace): Promise<Result<void>> {
    this.#state = { ...this.#state, workspaces: [...this.#state.workspaces, workspace] };
    return ok(undefined);
  }

  async rename(workspaceId: string, name: string): Promise<Result<void>> {
    this.#state = {
      ...this.#state,
      workspaces: this.#state.workspaces.map((item) => (item.id === workspaceId ? { ...item, name } : item)),
    };
    return ok(undefined);
  }

  async remove(workspaceId: string): Promise<Result<void>> {
    this.#state = {
      ...this.#state,
      workspaces: this.#state.workspaces.filter((item) => item.id !== workspaceId),
    };
    return ok(undefined);
  }

  setActive(workspaceId: string): Result<void> {
    this.#state = { ...this.#state, activeId: workspaceId };
    return ok(undefined);
  }

  /** La liste a changé ailleurs (invitation acceptée, accès révoqué, autre appareil). */
  remoteChange(workspaces: Workspace[]): void {
    this.#state = { ...this.#state, workspaces };
    this.#listeners.forEach((listener) => listener(workspaces));
  }
}
