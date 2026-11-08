import { createInitialDataset } from '@/core/seed';
import { migrateDataset } from '@/core/migrate';
import { settleDuePlanned } from '@/core/planned';
import { syncRecurring } from '@/core/recurring';
import { monthKeyOf, todayIso } from '@/core/dates';
import type { AuditEntry, CollectionName, Dataset, Settings } from '@/core/model';
import { SCHEMA_VERSION } from '@/core/model';
import { orderCategories } from '@/core/categoryOrder';
import type { WorkspaceData } from '@/core/fullBackup';
import { fail, ok, type AppError, type Result } from '@/core/errors';
import {
  type AuditLog,
  type CollectionItem,
  type FinanceGatewayInterface,
  type FinanceRepositoryInterface,
  type WorkspaceRegistryInterface,
} from '@/core/ports';
import {
  activeIn,
  DEFAULT_WORKSPACE,
  importedWorkspace,
  newLocalWorkspace,
  renamedWorkspaces,
  replaceWorkspace,
  sharedWorkspace,
  touchedWorkspace,
  upsertWorkspace,
  type ImportTarget,
  type Workspace,
} from '@/core/workspaces';

export type StoreStatus = 'loading' | 'ready' | 'error';

export type StoreState = {
  status: StoreStatus;
  dataset: Dataset | null;
  error: AppError | null;
  syncError: AppError | null;
  workspaces: Workspace[];
  workspace: Workspace;
};

type Listener = () => void;

type RepositoryFactory = (workspaceId: string) => FinanceRepositoryInterface;

export type { ImportTarget } from '../workspaces';

const MAX_AUDIT_ENTRIES = 500;

const recurringSummary = (created: number, linked: number): string => {
  const parts = [
    created > 0
      ? `${created} opération${created > 1 ? 's' : ''} prévue${created > 1 ? 's' : ''} ajoutée${created > 1 ? 's' : ''}`
      : '',
    linked > 0
      ? `${linked} opération${linked > 1 ? 's' : ''} saisie${linked > 1 ? 's' : ''} à la main rattachée${linked > 1 ? 's' : ''}`
      : '',
  ];
  return `Génération automatique : ${parts.filter(Boolean).join(', ')}`;
};

const settledSummary = (count: number): string => {
  if (count === 1) {
    return '1 opération prévue passée en réalisé à sa date';
  }
  return `${count} opérations prévues passées en réalisé à leur date`;
};

export interface FinanceStoreInterface {
  subscribe(listener: Listener): () => void;
  getSnapshot(): StoreState;
  start(): Promise<void>;
  settleDue(): Promise<Result<void>>;
  refresh(): Promise<Result<void>>;
  syncRecurring(): Promise<Result<void>>;
  upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: AuditLog,
  ): Promise<Result<void>>;
  remove(collection: CollectionName, keys: string[], log: AuditLog): Promise<Result<void>>;
  updateSettings(patch: Partial<Settings>, log: AuditLog | null): Promise<Result<void>>;
  restore(dataset: Dataset, log: AuditLog): Promise<Result<void>>;
  switchWorkspace(workspaceId: string): Promise<Result<void>>;
  createWorkspace(name: string): Promise<Result<void>>;
  importWorkspace(dataset: Dataset, target: ImportTarget): Promise<Result<void>>;
  renameWorkspace(workspaceId: string, name: string): Result<void>;
  deleteWorkspace(workspaceId: string): Promise<Result<void>>;
  markShared(workspaceId: string): Result<void>;
  workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>>;
  allWorkspaceData(): Promise<Result<WorkspaceData[]>>;
  restoreAll(entries: WorkspaceData[], activeId: string): Promise<Result<void>>;
}

const AUTOMATIC_SETTINGS: (keyof Settings)[] = ['theme'];

const isAutomaticSettings = (patch: Partial<Settings>): boolean =>
  (Object.keys(patch) as (keyof Settings)[]).every((key) => AUTOMATIC_SETTINGS.includes(key));

const keyOf = (collection: CollectionName, item: object): string => {
  if (collection === 'budgets') {
    return (item as { month: string }).month;
  }
  if (collection === 'yearBudgets') {
    return (item as { year: string }).year;
  }
  return (item as { id: string }).id;
};

const withOrderedCategories = (patch: Partial<StoreState>): Partial<StoreState> => {
  if (!patch.dataset) {
    return patch;
  }
  return { ...patch, dataset: { ...patch.dataset, categories: orderCategories(patch.dataset.categories) } };
};

export class FinanceStore implements FinanceStoreInterface, FinanceGatewayInterface {
  #createRepository: RepositoryFactory;
  #repository: FinanceRepositoryInterface;
  #state: StoreState;
  #listeners = new Set<Listener>();
  #newId: () => string;
  #now: () => Date;
  #registry: WorkspaceRegistryInterface;
  #registryLoaded = false;
  #syncing = false;
  #automatic = false;

  constructor(
    createRepository: RepositoryFactory,
    registry: WorkspaceRegistryInterface,
    newId: () => string,
    now: () => Date = () => new Date(),
  ) {
    this.#createRepository = createRepository;
    this.#registry = registry;
    this.#repository = createRepository(DEFAULT_WORKSPACE.id);
    this.#state = {
      status: 'loading',
      dataset: null,
      error: null,
      syncError: null,
      workspaces: [DEFAULT_WORKSPACE],
      workspace: DEFAULT_WORKSPACE,
    };
    this.#newId = newId;
    this.#now = now;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.#state;

  currentDataset(): Dataset | null {
    return this.#state.dataset;
  }

  #set(patch: Partial<StoreState>) {
    this.#state = { ...this.#state, ...withOrderedCategories(patch) };
    this.#listeners.forEach((listener) => listener());
  }

  #dataset(): Dataset {
    if (!this.#state.dataset) {
      throw new Error('Les données ne sont pas chargées.');
    }
    return this.#state.dataset;
  }

  #auditEntry(log: AuditLog): AuditEntry {
    return { id: this.#newId(), at: this.#now().toISOString(), ...log };
  }

  async #appendAudit(dataset: Dataset, log: AuditLog): Promise<Result<Dataset>> {
    const entry = this.#auditEntry(log);
    const audit = [entry, ...dataset.audit];
    const overflow = audit.slice(MAX_AUDIT_ENTRIES).map((item) => item.id);
    const written = await this.#repository.put('audit', [entry]);
    if (!written.ok) {
      return written;
    }
    if (overflow.length > 0) {
      const trimmed = await this.#repository.remove('audit', overflow);
      if (!trimmed.ok) {
        return trimmed;
      }
    }
    return ok({ ...dataset, audit: audit.slice(0, MAX_AUDIT_ENTRIES) });
  }

  async #commit(updated: Dataset, log: AuditLog, touches: boolean): Promise<Result<void>> {
    const audited = await this.#appendAudit(updated, log);
    if (!audited.ok) {
      return audited;
    }
    this.#set({ dataset: audited.value });
    return touches ? this.#touch() : ok(undefined);
  }

  async #loadRegistry(): Promise<void> {
    if (this.#registryLoaded) {
      return;
    }
    const { workspaces, activeId } = await this.#registry.load();
    const workspace = workspaces.find((item) => item.id === activeId) ?? DEFAULT_WORKSPACE;
    this.#registryLoaded = true;
    await this.#repository.close();
    this.#repository = this.#createRepository(workspace.id);
    this.#set({ workspaces, workspace });
  }

  #saveRegistry(workspaces: Workspace[], active: Workspace): Result<void> {
    const saved = this.#registry.save(workspaces, active.id);
    if (saved.ok) {
      this.#set({ workspaces, workspace: active });
    }
    return saved;
  }

  #touch(): Result<void> {
    if (this.#automatic) {
      return ok(undefined);
    }
    const active = touchedWorkspace(this.#state.workspace, this.#now());
    return this.#saveRegistry(replaceWorkspace(this.#state.workspaces, active), active);
  }

  async #automatically<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.#automatic;
    this.#automatic = true;
    try {
      return await task();
    } finally {
      this.#automatic = previous;
    }
  }

  markShared(workspaceId: string): Result<void> {
    const target = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!target) {
      return fail('workspace-not-found');
    }
    const workspaces = replaceWorkspace(this.#state.workspaces, sharedWorkspace(target, this.#now()));
    return this.#saveRegistry(workspaces, activeIn(workspaces, this.#state.workspace.id));
  }

  async start(): Promise<void> {
    this.#set({ status: 'loading', error: null });
    await this.#loadRegistry();
    const loaded = await this.#repository.load();
    if (!loaded.ok) {
      this.#set({ status: 'error', error: loaded.error });
      return;
    }
    if (loaded.value) {
      await this.#openExisting(loaded.value);
      await this.refresh();
      return;
    }
    const today = todayIso(this.#now());
    const seed = createInitialDataset(today, this.#newId);
    const saved = await this.#repository.replaceAll(seed);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.error });
      return;
    }
    this.#set({ status: 'ready', dataset: seed });
  }

  async refresh(): Promise<Result<void>> {
    const synced = await this.syncRecurring();
    const result = synced.ok ? await this.settleDue() : synced;
    this.#set({ syncError: result.ok ? null : result.error });
    return result;
  }

  async syncRecurring(): Promise<Result<void>> {
    const dataset = this.#state.dataset;
    if (!dataset || this.#syncing) {
      return ok(undefined);
    }
    const now = this.#now();
    const sync = syncRecurring(
      dataset.recurrings,
      dataset.transactions,
      monthKeyOf(todayIso(now)),
      this.#newId,
      now.toISOString(),
    );
    if (sync.recurrings.length === 0) {
      return ok(undefined);
    }
    this.#syncing = true;
    try {
      return await this.#automatically(async () => {
        const transactions = [...sync.created, ...sync.linked];
        if (transactions.length > 0) {
          const saved = await this.upsert('transactions', transactions, {
            action: 'creation',
            entity: 'Récurrences',
            summary: recurringSummary(sync.created.length, sync.linked.length),
          });
          if (!saved.ok) {
            return saved;
          }
        }
        return this.#saveWithoutAudit('recurrings', sync.recurrings);
      });
    } finally {
      this.#syncing = false;
    }
  }

  async #saveWithoutAudit<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
  ): Promise<Result<void>> {
    const result = await this.#repository.put(collection, items);
    if (!result.ok) {
      return result;
    }
    const dataset = this.#dataset();
    const keys = new Set(items.map((item) => keyOf(collection, item)));
    const current = dataset[collection] as CollectionItem<C>[];
    const kept = current.filter((item) => !keys.has(keyOf(collection, item)));
    this.#set({ dataset: { ...dataset, [collection]: [...kept, ...items] } as Dataset });
    return result;
  }

  async settleDue(): Promise<Result<void>> {
    const dataset = this.#state.dataset;
    if (!dataset) {
      return ok(undefined);
    }
    const settled = settleDuePlanned(dataset.transactions, todayIso(this.#now()), this.#now().toISOString());
    if (settled.length === 0) {
      return ok(undefined);
    }
    return this.#automatically(() =>
      this.upsert('transactions', settled, {
        action: 'modification',
        entity: 'Opérations',
        summary: `Bascule automatique : ${settledSummary(settled.length)}`,
      }),
    );
  }

  async #openExisting(dataset: Dataset): Promise<void> {
    if (dataset.schemaVersion >= SCHEMA_VERSION) {
      this.#set({ status: 'ready', dataset });
      return;
    }
    const migrated = migrateDataset(dataset);
    const saved = await this.#repository.replaceAll(migrated);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.error });
      return;
    }
    this.#set({ status: 'ready', dataset: migrated });
  }

  async upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: AuditLog,
  ): Promise<Result<void>> {
    const result = await this.#repository.put(collection, items);
    if (!result.ok) {
      return result;
    }
    const dataset = this.#dataset();
    const keys = new Set(items.map((item) => keyOf(collection, item)));
    const current = dataset[collection] as CollectionItem<C>[];
    const kept = current.filter((item) => !keys.has(keyOf(collection, item)));
    const updated = { ...dataset, [collection]: [...kept, ...items] } as Dataset;
    const committed = await this.#commit(updated, log, true);
    if (!committed.ok) {
      return committed;
    }
    if (collection === 'recurrings') {
      return this.syncRecurring();
    }
    if (collection === 'transactions') {
      return this.settleDue();
    }
    return committed;
  }

  async remove(collection: CollectionName, keys: string[], log: AuditLog): Promise<Result<void>> {
    const result = await this.#repository.remove(collection, keys);
    if (!result.ok) {
      return result;
    }
    const dataset = this.#dataset();
    const removed = new Set(keys);
    const current = dataset[collection] as object[];
    const updated = {
      ...dataset,
      [collection]: current.filter((item) => !removed.has(keyOf(collection, item))),
    } as Dataset;
    return this.#commit(updated, log, true);
  }

  async updateSettings(patch: Partial<Settings>, log: AuditLog | null): Promise<Result<void>> {
    const dataset = this.#dataset();
    const settings = { ...dataset.settings, ...patch };
    const result = await this.#repository.saveSettings(settings);
    if (!result.ok) {
      return result;
    }
    const updated = { ...dataset, settings };
    const touches = !isAutomaticSettings(patch);
    if (!log) {
      this.#set({ dataset: updated });
      return touches ? this.#touch() : result;
    }
    return this.#commit(updated, log, touches);
  }

  async restore(dataset: Dataset, log: AuditLog): Promise<Result<void>> {
    const withAudit = {
      ...dataset,
      audit: [this.#auditEntry(log), ...dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
    };
    const result = await this.#repository.replaceAll(withAudit);
    if (!result.ok) {
      return result;
    }
    this.#set({ dataset: withAudit });
    const touched = this.#touch();
    if (!touched.ok) {
      return touched;
    }
    return this.refresh();
  }

  async switchWorkspace(workspaceId: string): Promise<Result<void>> {
    const workspace = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return fail('workspace-not-found');
    }
    if (workspace.id === this.#state.workspace.id) {
      return ok(undefined);
    }
    const saved = this.#saveRegistry(this.#state.workspaces, workspace);
    if (!saved.ok) {
      return saved;
    }
    await this.#repository.close();
    this.#repository = this.#createRepository(workspace.id);
    this.#set({ dataset: null });
    await this.start();
    return ok(undefined);
  }

  async createWorkspace(name: string): Promise<Result<void>> {
    const workspace = newLocalWorkspace(name, this.#state.workspaces, this.#newId);
    if (!workspace.ok) {
      return workspace;
    }
    const saved = this.#saveRegistry([...this.#state.workspaces, workspace.value], this.#state.workspace);
    if (!saved.ok) {
      return saved;
    }
    return this.switchWorkspace(workspace.value.id);
  }

  async importWorkspace(dataset: Dataset, target: ImportTarget): Promise<Result<void>> {
    const workspace = importedWorkspace(target, this.#state.workspaces, this.#now(), this.#newId);
    if (!workspace.ok) {
      return workspace;
    }
    const withAudit = {
      ...dataset,
      audit: [
        this.#auditEntry({
          action: 'restauration',
          entity: 'Espace',
          summary: `Import de l’espace « ${workspace.value.name} »`,
        }),
        ...dataset.audit,
      ].slice(0, MAX_AUDIT_ENTRIES),
    };
    const isActive = this.#state.workspace.id === workspace.value.id;
    const repository = isActive ? this.#repository : this.#createRepository(workspace.value.id);
    const written = await repository.replaceAll(withAudit);
    if (!isActive) {
      await repository.close();
    }
    if (!written.ok) {
      return written;
    }
    const workspaces = upsertWorkspace(this.#state.workspaces, workspace.value);
    if (isActive) {
      const saved = this.#saveRegistry(workspaces, workspace.value);
      if (saved.ok) {
        this.#set({ dataset: withAudit });
      }
      return saved;
    }
    const saved = this.#saveRegistry(workspaces, this.#state.workspace);
    if (!saved.ok) {
      return saved;
    }
    return this.switchWorkspace(workspace.value.id);
  }

  renameWorkspace(workspaceId: string, name: string): Result<void> {
    const workspaces = renamedWorkspaces(this.#state.workspaces, workspaceId, name);
    if (!workspaces.ok) {
      return workspaces;
    }
    return this.#saveRegistry(workspaces.value, activeIn(workspaces.value, this.#state.workspace.id));
  }

  async deleteWorkspace(workspaceId: string): Promise<Result<void>> {
    if (workspaceId === DEFAULT_WORKSPACE.id) {
      return fail('workspace-main-protected');
    }
    if (this.#state.workspace.id === workspaceId) {
      const switched = await this.switchWorkspace(DEFAULT_WORKSPACE.id);
      if (!switched.ok) {
        return switched;
      }
    }
    const destroyed = await this.#createRepository(workspaceId).destroy();
    if (!destroyed.ok) {
      return destroyed;
    }
    const workspaces = this.#state.workspaces.filter((item) => item.id !== workspaceId);
    return this.#saveRegistry(workspaces, this.#state.workspace);
  }

  async workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>> {
    const workspace = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return fail('workspace-not-found');
    }
    if (workspace.id === this.#state.workspace.id && this.#state.dataset) {
      return ok({ workspace, dataset: this.#state.dataset });
    }
    const repository = this.#createRepository(workspace.id);
    const loaded = await repository.load();
    await repository.close();
    if (!loaded.ok) {
      return loaded;
    }
    return ok(loaded.value ? { workspace, dataset: loaded.value } : null);
  }

  async allWorkspaceData(): Promise<Result<WorkspaceData[]>> {
    const entries: WorkspaceData[] = [];
    for (const workspace of this.#state.workspaces) {
      const entry = await this.workspaceData(workspace.id);
      if (!entry.ok) {
        return entry;
      }
      if (entry.value) {
        entries.push(entry.value);
      }
    }
    return ok(entries);
  }

  async restoreAll(entries: WorkspaceData[], activeId: string): Promise<Result<void>> {
    const log: AuditLog = {
      action: 'restauration',
      entity: 'Sauvegarde',
      summary: 'Restauration d’une sauvegarde complète',
    };
    await this.#repository.close();
    for (const entry of entries) {
      const repository = this.#createRepository(entry.workspace.id);
      const written = await repository.replaceAll({
        ...entry.dataset,
        audit: [this.#auditEntry(log), ...entry.dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
      });
      await repository.close();
      if (!written.ok) {
        return written;
      }
    }
    const workspaces = entries.map((entry) => entry.workspace);
    const kept = new Set(workspaces.map((workspace) => workspace.id));
    const removed = this.#state.workspaces.filter((item) => !kept.has(item.id));
    const active = activeIn(workspaces, activeId);
    const saved = this.#saveRegistry(workspaces, active);
    if (!saved.ok) {
      return saved;
    }
    this.#repository = this.#createRepository(active.id);
    this.#set({ dataset: null });
    await this.start();
    for (const workspace of removed) {
      const destroyed = await this.#createRepository(workspace.id).destroy();
      if (!destroyed.ok) {
        return destroyed;
      }
    }
    return ok(undefined);
  }
}
