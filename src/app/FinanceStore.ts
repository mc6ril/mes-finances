import { createInitialDataset } from '@/core/seed';
import { migrateDataset } from '@/core/migrate';
import { settleDuePlanned } from '@/core/planned';
import { syncRecurring } from '@/core/recurring';
import { monthKeyOf, todayIso } from '@/core/dates';
import type { AuditAction, AuditEntry, CollectionName, Dataset, Settings } from '@/core/model';
import { SCHEMA_VERSION } from '@/core/model';
import { orderCategories } from '@/core/categoryOrder';
import type { WorkspaceData } from '@/core/fullBackup';
import {
  failure,
  success,
  type CollectionItem,
  type FinanceRepositoryInterface,
  type PortResult,
  type WorkspaceRegistryInterface,
} from '@/core/ports';
import {
  DEFAULT_WORKSPACE,
  isReadOnly,
  normalizeWorkspaceName,
  workspaceNameError,
  type Workspace,
} from '@/core/workspaces';

export type StoreStatus = 'loading' | 'ready' | 'error';

export type StoreState = {
  status: StoreStatus;
  dataset: Dataset | null;
  error: string | null;
  workspaces: Workspace[];
  workspace: Workspace;
};

type Listener = () => void;

type RepositoryFactory = (workspaceId: string) => FinanceRepositoryInterface;

export type ImportTarget = { kind: 'new'; name: string } | { kind: 'existing'; workspaceId: string };

type ChangeLog = { action: AuditAction; entity: string; summary: string };

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
  settleDue(): Promise<void>;
  refresh(): Promise<void>;
  syncRecurring(): Promise<void>;
  upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: ChangeLog,
  ): Promise<PortResult<void>>;
  remove(collection: CollectionName, keys: string[], log: ChangeLog): Promise<PortResult<void>>;
  updateSettings(patch: Partial<Settings>, log: ChangeLog | null): Promise<PortResult<void>>;
  restore(dataset: Dataset, log: ChangeLog): Promise<PortResult<void>>;
  switchWorkspace(workspaceId: string): Promise<void>;
  createWorkspace(name: string): Promise<PortResult<void>>;
  importWorkspace(dataset: Dataset, target: ImportTarget): Promise<PortResult<void>>;
  renameWorkspace(workspaceId: string, name: string): PortResult<void>;
  deleteWorkspace(workspaceId: string): Promise<PortResult<void>>;
  workspaceData(workspaceId: string): Promise<PortResult<WorkspaceData | null>>;
  allWorkspaceData(): Promise<PortResult<WorkspaceData[]>>;
  restoreAll(entries: WorkspaceData[], activeId: string): Promise<PortResult<void>>;
}

const READ_ONLY_MESSAGE =
  'Cet espace est importé : il est en lecture seule. Pour le mettre à jour, importe le nouveau fichier dans Paramètres.';

const onlyTheme = (patch: Partial<Settings>): boolean => Object.keys(patch).every((key) => key === 'theme');

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

export class FinanceStore implements FinanceStoreInterface {
  #createRepository: RepositoryFactory;
  #repository: FinanceRepositoryInterface;
  #state: StoreState;
  #listeners = new Set<Listener>();
  #newId: () => string;
  #now: () => Date;
  #registry: WorkspaceRegistryInterface;
  #registryLoaded = false;
  #syncing = false;

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

  #auditEntry(log: ChangeLog): AuditEntry {
    return { id: this.#newId(), at: this.#now().toISOString(), ...log };
  }

  async #appendAudit(dataset: Dataset, log: ChangeLog): Promise<Dataset> {
    const entry = this.#auditEntry(log);
    const audit = [entry, ...dataset.audit];
    const overflow = audit.slice(MAX_AUDIT_ENTRIES).map((item) => item.id);
    await this.#repository.put('audit', [entry]);
    if (overflow.length > 0) {
      await this.#repository.remove('audit', overflow);
    }
    return { ...dataset, audit: audit.slice(0, MAX_AUDIT_ENTRIES) };
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

  #saveRegistry(workspaces: Workspace[], active: Workspace): void {
    this.#registry.save(workspaces, active.id);
    this.#set({ workspaces, workspace: active });
  }

  #readOnly(): boolean {
    return isReadOnly(this.#state.workspace);
  }

  async start(): Promise<void> {
    this.#set({ status: 'loading', error: null });
    await this.#loadRegistry();
    const loaded = await this.#repository.load();
    if (!loaded.ok) {
      this.#set({ status: 'error', error: loaded.message });
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
      this.#set({ status: 'error', error: saved.message });
      return;
    }
    this.#set({ status: 'ready', dataset: seed });
  }

  async refresh(): Promise<void> {
    await this.syncRecurring();
    await this.settleDue();
  }

  async syncRecurring(): Promise<void> {
    const dataset = this.#state.dataset;
    if (!dataset || this.#readOnly() || this.#syncing) {
      return;
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
      return;
    }
    this.#syncing = true;
    try {
      const transactions = [...sync.created, ...sync.linked];
      if (transactions.length > 0) {
        await this.upsert('transactions', transactions, {
          action: 'creation',
          entity: 'Récurrences',
          summary: recurringSummary(sync.created.length, sync.linked.length),
        });
      }
      await this.#saveQuietly('recurrings', sync.recurrings);
    } finally {
      this.#syncing = false;
    }
  }

  async #saveQuietly<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<void> {
    const result = await this.#repository.put(collection, items);
    if (!result.ok) {
      return;
    }
    const dataset = this.#dataset();
    const keys = new Set(items.map((item) => keyOf(collection, item)));
    const current = dataset[collection] as CollectionItem<C>[];
    const kept = current.filter((item) => !keys.has(keyOf(collection, item)));
    this.#set({ dataset: { ...dataset, [collection]: [...kept, ...items] } as Dataset });
  }

  async settleDue(): Promise<void> {
    const dataset = this.#state.dataset;
    if (!dataset || this.#readOnly()) {
      return;
    }
    const settled = settleDuePlanned(dataset.transactions, todayIso(this.#now()), this.#now().toISOString());
    if (settled.length === 0) {
      return;
    }
    await this.upsert('transactions', settled, {
      action: 'modification',
      entity: 'Opérations',
      summary: `Bascule automatique : ${settledSummary(settled.length)}`,
    });
  }

  async #openExisting(dataset: Dataset): Promise<void> {
    if (dataset.schemaVersion >= SCHEMA_VERSION) {
      this.#set({ status: 'ready', dataset });
      return;
    }
    const migrated = migrateDataset(dataset);
    const saved = await this.#repository.replaceAll(migrated);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.message });
      return;
    }
    this.#set({ status: 'ready', dataset: migrated });
  }

  async upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: ChangeLog,
  ): Promise<PortResult<void>> {
    if (this.#readOnly()) {
      return failure('lecture-seule', READ_ONLY_MESSAGE);
    }
    const result = await this.#repository.put(collection, items);
    if (!result.ok) {
      return result;
    }
    const dataset = this.#dataset();
    const keys = new Set(items.map((item) => keyOf(collection, item)));
    const current = dataset[collection] as CollectionItem<C>[];
    const kept = current.filter((item) => !keys.has(keyOf(collection, item)));
    const updated = { ...dataset, [collection]: [...kept, ...items] } as Dataset;
    this.#set({ dataset: await this.#appendAudit(updated, log) });
    if (collection === 'recurrings') {
      await this.syncRecurring();
    }
    if (collection === 'transactions') {
      await this.settleDue();
    }
    return result;
  }

  async remove(collection: CollectionName, keys: string[], log: ChangeLog): Promise<PortResult<void>> {
    if (this.#readOnly()) {
      return failure('lecture-seule', READ_ONLY_MESSAGE);
    }
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
    this.#set({ dataset: await this.#appendAudit(updated, log) });
    return result;
  }

  async updateSettings(patch: Partial<Settings>, log: ChangeLog | null): Promise<PortResult<void>> {
    if (this.#readOnly() && !onlyTheme(patch)) {
      return failure('lecture-seule', READ_ONLY_MESSAGE);
    }
    const dataset = this.#dataset();
    const settings = { ...dataset.settings, ...patch };
    const result = await this.#repository.saveSettings(settings);
    if (!result.ok) {
      return result;
    }
    const updated = { ...dataset, settings };
    if (!log) {
      this.#set({ dataset: updated });
      return result;
    }
    this.#set({ dataset: await this.#appendAudit(updated, log) });
    return result;
  }

  async restore(dataset: Dataset, log: ChangeLog): Promise<PortResult<void>> {
    if (this.#readOnly()) {
      return failure('lecture-seule', READ_ONLY_MESSAGE);
    }
    const withAudit = {
      ...dataset,
      audit: [this.#auditEntry(log), ...dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
    };
    const result = await this.#repository.replaceAll(withAudit);
    if (result.ok) {
      this.#set({ dataset: withAudit });
      await this.refresh();
    }
    return result;
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace || workspace.id === this.#state.workspace.id) {
      return;
    }
    await this.#repository.close();
    this.#repository = this.#createRepository(workspace.id);
    this.#saveRegistry(this.#state.workspaces, workspace);
    this.#set({ dataset: null });
    await this.start();
  }

  async createWorkspace(name: string): Promise<PortResult<void>> {
    const error = workspaceNameError(name, this.#state.workspaces);
    if (error) {
      return failure('invalide', error);
    }
    const workspace: Workspace = {
      id: this.#newId(),
      name: normalizeWorkspaceName(name),
      source: 'local',
      importedAt: null,
    };
    this.#saveRegistry([...this.#state.workspaces, workspace], this.#state.workspace);
    await this.switchWorkspace(workspace.id);
    return success(undefined);
  }

  async importWorkspace(dataset: Dataset, target: ImportTarget): Promise<PortResult<void>> {
    const workspace = this.#importedWorkspace(target);
    if (!workspace.ok) {
      return workspace;
    }
    const log: ChangeLog = {
      action: 'restauration',
      entity: 'Espace',
      summary: `Import de l’espace « ${workspace.value.name} »`,
    };
    const withAudit = {
      ...dataset,
      audit: [this.#auditEntry(log), ...dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
    };
    const isActive = this.#state.workspace.id === workspace.value.id;
    const repository = isActive ? this.#repository : this.#createRepository(workspace.value.id);
    const saved = await repository.replaceAll(withAudit);
    if (!isActive) {
      await repository.close();
    }
    if (!saved.ok) {
      return saved;
    }
    const workspaces = [
      ...this.#state.workspaces.filter((item) => item.id !== workspace.value.id),
      workspace.value,
    ];
    if (isActive) {
      this.#saveRegistry(workspaces, workspace.value);
      this.#set({ dataset: withAudit });
      return success(undefined);
    }
    this.#saveRegistry(workspaces, this.#state.workspace);
    await this.switchWorkspace(workspace.value.id);
    return success(undefined);
  }

  #importedWorkspace(target: ImportTarget): PortResult<Workspace> {
    const importedAt = this.#now().toISOString();
    if (target.kind === 'existing') {
      const existing = this.#state.workspaces.find((item) => item.id === target.workspaceId);
      if (!existing || !isReadOnly(existing)) {
        return failure('invalide', 'Seul un espace déjà importé peut être mis à jour par un fichier.');
      }
      return success({ ...existing, importedAt });
    }
    const error = workspaceNameError(target.name, this.#state.workspaces);
    if (error) {
      return failure('invalide', error);
    }
    return success({
      id: this.#newId(),
      name: normalizeWorkspaceName(target.name),
      source: 'import',
      importedAt,
    });
  }

  renameWorkspace(workspaceId: string, name: string): PortResult<void> {
    const error = workspaceNameError(name, this.#state.workspaces, workspaceId);
    if (error) {
      return failure('invalide', error);
    }
    const workspaces = this.#state.workspaces.map((item) =>
      item.id === workspaceId ? { ...item, name: normalizeWorkspaceName(name) } : item,
    );
    const active = workspaces.find((item) => item.id === this.#state.workspace.id) ?? DEFAULT_WORKSPACE;
    this.#saveRegistry(workspaces, active);
    return success(undefined);
  }

  async deleteWorkspace(workspaceId: string): Promise<PortResult<void>> {
    if (workspaceId === DEFAULT_WORKSPACE.id) {
      return failure('invalide', 'L’espace principal ne peut pas être supprimé.');
    }
    if (this.#state.workspace.id === workspaceId) {
      await this.switchWorkspace(DEFAULT_WORKSPACE.id);
    }
    const destroyed = await this.#createRepository(workspaceId).destroy();
    if (!destroyed.ok) {
      return destroyed;
    }
    const workspaces = this.#state.workspaces.filter((item) => item.id !== workspaceId);
    this.#saveRegistry(workspaces, this.#state.workspace);
    return success(undefined);
  }

  async workspaceData(workspaceId: string): Promise<PortResult<WorkspaceData | null>> {
    const workspace = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return failure('invalide', 'Espace introuvable.');
    }
    if (workspace.id === this.#state.workspace.id && this.#state.dataset) {
      return success({ workspace, dataset: this.#state.dataset });
    }
    const repository = this.#createRepository(workspace.id);
    const loaded = await repository.load();
    await repository.close();
    if (!loaded.ok) {
      return loaded;
    }
    return success(loaded.value ? { workspace, dataset: loaded.value } : null);
  }

  async allWorkspaceData(): Promise<PortResult<WorkspaceData[]>> {
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
    return success(entries);
  }

  async restoreAll(entries: WorkspaceData[], activeId: string): Promise<PortResult<void>> {
    const log: ChangeLog = {
      action: 'restauration',
      entity: 'Sauvegarde',
      summary: 'Restauration d’une sauvegarde complète',
    };
    await this.#repository.close();
    for (const entry of entries) {
      const repository = this.#createRepository(entry.workspace.id);
      const saved = await repository.replaceAll({
        ...entry.dataset,
        audit: [this.#auditEntry(log), ...entry.dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
      });
      await repository.close();
      if (!saved.ok) {
        return saved;
      }
    }
    const kept = new Set(entries.map((entry) => entry.workspace.id));
    for (const workspace of this.#state.workspaces.filter((item) => !kept.has(item.id))) {
      await this.#createRepository(workspace.id).destroy();
    }
    const workspaces = entries.map((entry) => entry.workspace);
    const active = workspaces.find((item) => item.id === activeId) ?? workspaces[0] ?? DEFAULT_WORKSPACE;
    this.#repository = this.#createRepository(active.id);
    this.#saveRegistry(workspaces, active);
    this.#set({ dataset: null });
    await this.start();
    return success(undefined);
  }
}
