import { orderCategories } from '@/core/budget/categoryOrder';
import { settleDuePlanned } from '@/core/budget/planned';
import type { WorkspaceRegistryInterface } from '@/core/espaces/interface';
import {
  activeIn,
  canDelete,
  isMainWorkspace,
  newWorkspace,
  renamedWorkspaces,
  sortWorkspaces,
  type Workspace,
} from '@/core/espaces/workspaces';
import type { WorkspaceData } from '@/core/sauvegarde/fullBackup';
import { migrateDataset } from '@/core/sauvegarde/migrate';
import { planRestore } from '@/core/sauvegarde/restorePlan';
import { itemKey } from '@/core/shared/collections';
import { todayIso } from '@/core/shared/dates';
import { type AppError, fail, ok, type Result } from '@/core/shared/errors';
import type { AuditEntry, CollectionName, Dataset, Settings, WorkspaceKind } from '@/core/shared/model';
import { SCHEMA_VERSION } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import type {
  AuditLog,
  CollectionItem,
  FinanceGatewayInterface,
  FinanceRepositoryInterface,
} from '@/core/store/interface';

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

const MAX_AUDIT_ENTRIES = 500;

const settledSummary = (count: number): string => {
  if (count === 1) {
    return '1 opération prévue passée à sa date';
  }
  return `${count} opérations prévues passées à leur date`;
};

export interface FinanceStoreInterface {
  subscribe(listener: Listener): () => void;
  getSnapshot(): StoreState;
  start(): Promise<void>;
  stop(): void;
  settleDue(): Promise<Result<void>>;
  refresh(): Promise<Result<void>>;
  upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: AuditLog,
  ): Promise<Result<void>>;
  remove(collection: CollectionName, keys: string[], log: AuditLog): Promise<Result<void>>;
  updateSettings(patch: Partial<Settings>, log: AuditLog | null): Promise<Result<void>>;
  restore(dataset: Dataset, log: AuditLog): Promise<Result<void>>;
  switchWorkspace(workspaceId: string): Promise<Result<void>>;
  createWorkspace(name: string, kind?: WorkspaceKind): Promise<Result<void>>;
  renameWorkspace(workspaceId: string, name: string): Promise<Result<void>>;
  deleteWorkspace(workspaceId: string): Promise<Result<void>>;
  workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>>;
  allWorkspaceData(): Promise<Result<WorkspaceData[]>>;
  restoreAll(entries: WorkspaceData[], activeId: string): Promise<Result<void>>;
}

/** Espace affiché avant le chargement de la liste (aucun compte connecté, ou liste en cours). */
const UNLOADED_WORKSPACE: Workspace = { id: '', name: 'Mon espace', kind: 'perso', role: 'owner' };

const notLoaded = async <T>(): Promise<Result<T>> => fail('workspace-not-found');

/** Dépôt tant que la liste des espaces n'est pas chargée : rien ne s'écrit nulle part. */
const UNLOADED_REPOSITORY: FinanceRepositoryInterface = {
  load: () => notLoaded<Dataset | null>(),
  watch: () => () => undefined,
  saveSettings: () => notLoaded<void>(),
  put: () => notLoaded<void>(),
  remove: () => notLoaded<void>(),
  replaceAll: () => notLoaded<void>(),
  destroy: () => notLoaded<void>(),
  close: async () => undefined,
};

const INITIAL_STATE: StoreState = {
  status: 'loading',
  dataset: null,
  error: null,
  syncError: null,
  workspaces: [],
  workspace: UNLOADED_WORKSPACE,
};

const withOrderedCategories = (patch: Partial<StoreState>): Partial<StoreState> => {
  if (!patch.dataset) {
    return patch;
  }
  return {
    ...patch,
    dataset: {
      ...patch.dataset,
      categories: orderCategories(patch.dataset.categories, patch.dataset.settings.kind),
    },
  };
};

export class FinanceStore implements FinanceStoreInterface, FinanceGatewayInterface {
  #createRepository: RepositoryFactory;
  #repository: FinanceRepositoryInterface;
  #state: StoreState = INITIAL_STATE;
  #listeners = new Set<Listener>();
  #newId: () => string;
  #now: () => Date;
  #registry: WorkspaceRegistryInterface;
  #registryLoaded = false;
  #unwatchRegistry: (() => void) | null = null;
  #unwatchDataset: (() => void) | null = null;
  /** Espaces créés sur cet appareil, pas encore vus dans une liste reçue du serveur. */
  #unconfirmed = new Map<string, Workspace>();
  /** Espace principal du compte connecté (`perso-<uid>`), connu une fois la liste chargée. */
  #main: Workspace = UNLOADED_WORKSPACE;

  constructor(
    createRepository: RepositoryFactory,
    registry: WorkspaceRegistryInterface,
    newId: () => string,
    now: () => Date = () => new Date(),
  ) {
    this.#createRepository = createRepository;
    this.#registry = registry;
    this.#repository = UNLOADED_REPOSITORY;
    this.#newId = newId;
    this.#now = now;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.#state;

  /** Liste reçue : l'espace principal reste toujours présent et en tête. */
  #withMain(workspaces: Workspace[]): Workspace[] {
    return sortWorkspaces(
      workspaces.some((item) => item.id === this.#main.id) ? workspaces : [this.#main, ...workspaces],
    );
  }

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

  async #commit(updated: Dataset, log: AuditLog): Promise<Result<void>> {
    const audited = await this.#appendAudit(updated, log);
    if (!audited.ok) {
      return audited;
    }
    this.#set({ dataset: audited.value });
    return ok(undefined);
  }

  async #loadRegistry(): Promise<Result<void>> {
    if (this.#registryLoaded) {
      return ok(undefined);
    }
    const loaded = await this.#registry.load();
    if (!loaded.ok) {
      return loaded;
    }
    const main = loaded.value.workspaces.find(isMainWorkspace);
    if (!main) {
      return fail('workspace-not-found');
    }
    this.#main = main;
    const workspaces = this.#withMain(loaded.value.workspaces);
    const workspace = activeIn(workspaces, loaded.value.activeId, main);
    this.#registryLoaded = true;
    await this.#repository.close();
    this.#repository = this.#createRepository(workspace.id);
    this.#set({ workspaces, workspace });
    this.#unwatchRegistry = this.#registry.watch((received) => void this.#onWorkspaces(received));
    return ok(undefined);
  }

  /** Liste modifiée ailleurs : si l'espace affiché a disparu (accès retiré), retour à l'espace principal. */
  async #onWorkspaces(received: Workspace[]): Promise<void> {
    received.forEach((item) => this.#unconfirmed.delete(item.id));
    // Une liste calculée avant une création récente arrive parfois après : l'espace créé reste.
    const pending = [...this.#unconfirmed.values()].filter(
      (item) => !received.some((other) => other.id === item.id),
    );
    const workspaces = this.#withMain([...received, ...pending]);
    const current = workspaces.find((item) => item.id === this.#state.workspace.id);
    if (current) {
      this.#set({ workspaces, workspace: current });
      return;
    }
    this.#set({ workspaces });
    await this.#open(this.#main);
  }

  #watchDataset(): void {
    this.#unwatchDataset?.();
    this.#unwatchDataset = this.#repository.watch((dataset) => this.#onRemoteDataset(dataset));
  }

  #stopWatchingDataset(): void {
    this.#unwatchDataset?.();
    this.#unwatchDataset = null;
  }

  /** Données modifiées ailleurs : affichées telles quelles, migrées en mémoire si plus anciennes. */
  #onRemoteDataset(dataset: Dataset): void {
    if (this.#state.status !== 'ready') {
      return;
    }
    if (dataset.schemaVersion > SCHEMA_VERSION) {
      this.#set({ status: 'error', error: { code: 'workspace-schema-too-recent' } });
      return;
    }
    this.#set({ dataset: dataset.schemaVersion < SCHEMA_VERSION ? migrateDataset(dataset) : dataset });
  }

  /** Ferme l'espace affiché et en ouvre un autre (déjà présent dans la liste). */
  async #open(workspace: Workspace): Promise<void> {
    this.#stopWatchingDataset();
    this.#registry.setActive(workspace.id);
    await this.#repository.close();
    this.#repository = this.#createRepository(workspace.id);
    this.#set({ workspace, dataset: null });
    await this.start();
  }

  async start(): Promise<void> {
    this.#set({ status: 'loading', error: null });
    const registry = await this.#loadRegistry();
    if (!registry.ok) {
      this.#set({ status: 'error', error: registry.error });
      return;
    }
    const loaded = await this.#repository.load();
    if (!loaded.ok) {
      this.#set({ status: 'error', error: loaded.error });
      return;
    }
    if (loaded.value) {
      const opened = await this.#openExisting(loaded.value);
      if (opened) {
        this.#watchDataset();
        await this.refresh();
      }
      return;
    }
    const today = todayIso(this.#now());
    const seed = createInitialDataset(today, this.#newId, this.#state.workspace.kind);
    const saved = await this.#repository.replaceAll(seed);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.error });
      return;
    }
    this.#set({ status: 'ready', dataset: seed });
    this.#watchDataset();
  }

  /** Arrête toute écoute et oublie les données (déconnexion, changement de compte). */
  stop(): void {
    this.#stopWatchingDataset();
    this.#unwatchRegistry?.();
    this.#unwatchRegistry = null;
    this.#registryLoaded = false;
    this.#unconfirmed.clear();
    void this.#repository.close();
    this.#repository = UNLOADED_REPOSITORY;
    this.#main = UNLOADED_WORKSPACE;
    this.#set(INITIAL_STATE);
  }

  async refresh(): Promise<Result<void>> {
    const result = await this.settleDue();
    this.#set({ syncError: result.ok ? null : result.error });
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
    return this.upsert('transactions', settled, {
      action: 'modification',
      entity: 'Opérations',
      summary: `Bascule automatique : ${settledSummary(settled.length)}`,
    });
  }

  /** Renvoie false si l'espace ne peut pas être ouvert (version plus récente, échec de migration). */
  async #openExisting(dataset: Dataset): Promise<boolean> {
    if (dataset.schemaVersion > SCHEMA_VERSION) {
      this.#set({ status: 'error', error: { code: 'workspace-schema-too-recent' } });
      return false;
    }
    if (dataset.schemaVersion === SCHEMA_VERSION) {
      this.#set({ status: 'ready', dataset });
      return true;
    }
    const migrated = migrateDataset(dataset);
    const saved = await this.#repository.replaceAll(migrated);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.error });
      return false;
    }
    this.#set({ status: 'ready', dataset: migrated });
    return true;
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
    const keys = new Set(items.map((item) => itemKey(collection, item)));
    const current = dataset[collection] as CollectionItem<C>[];
    const kept = current.filter((item) => !keys.has(itemKey(collection, item)));
    const updated = { ...dataset, [collection]: [...kept, ...items] } as Dataset;
    const committed = await this.#commit(updated, log);
    if (!committed.ok) {
      return committed;
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
      [collection]: current.filter((item) => !removed.has(itemKey(collection, item))),
    } as Dataset;
    return this.#commit(updated, log);
  }

  async updateSettings(patch: Partial<Settings>, log: AuditLog | null): Promise<Result<void>> {
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
    return this.#commit(updated, log);
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
    await this.#open(workspace);
    return ok(undefined);
  }

  async createWorkspace(name: string, kind: WorkspaceKind = 'perso'): Promise<Result<void>> {
    const workspace = newWorkspace(name, kind, this.#state.workspaces, this.#newId);
    if (!workspace.ok) {
      return workspace;
    }
    const created = await this.#registry.create(workspace.value);
    if (!created.ok) {
      return created;
    }
    this.#unconfirmed.set(workspace.value.id, workspace.value);
    this.#set({ workspaces: this.#withMain([...this.#state.workspaces, workspace.value]) });
    return this.switchWorkspace(workspace.value.id);
  }

  async renameWorkspace(workspaceId: string, name: string): Promise<Result<void>> {
    const workspaces = renamedWorkspaces(this.#state.workspaces, workspaceId, name);
    if (!workspaces.ok) {
      return workspaces;
    }
    const renamed = workspaces.value.find((item) => item.id === workspaceId);
    if (!renamed) {
      return fail('workspace-not-found');
    }
    const saved = await this.#registry.rename(workspaceId, renamed.name);
    if (!saved.ok) {
      return saved;
    }
    this.#set({
      workspaces: workspaces.value,
      workspace: activeIn(workspaces.value, this.#state.workspace.id, this.#main),
    });
    return ok(undefined);
  }

  async deleteWorkspace(workspaceId: string): Promise<Result<void>> {
    if (workspaceId === this.#main.id) {
      return fail('workspace-main-protected');
    }
    const workspace = this.#state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return fail('workspace-not-found');
    }
    if (!canDelete(workspace)) {
      return fail('workspace-not-owner');
    }
    if (this.#state.workspace.id === workspaceId) {
      await this.#open(this.#main);
    }
    const removed = await this.#destroy(workspaceId);
    if (!removed.ok) {
      return removed;
    }
    this.#set({ workspaces: this.#state.workspaces.filter((item) => item.id !== workspaceId) });
    return ok(undefined);
  }

  async #destroy(workspaceId: string): Promise<Result<void>> {
    this.#unconfirmed.delete(workspaceId);
    const repository = this.#createRepository(workspaceId);
    const destroyed = await repository.destroy();
    if (!destroyed.ok) {
      return destroyed;
    }
    return this.#registry.remove(workspaceId);
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

  /**
   * Restaure une sauvegarde complète « chez soi » (voir `planRestore`) : l'espace principal du fichier
   * remplit celui du compte connecté, les espaces dont on est membre sont remplacés, les autres
   * deviennent des copies à soi. Les espaces absents du fichier ne sont jamais touchés.
   * Les copies sont d'abord créées en un seul lot confirmé par le serveur : sans lui, rien n'est écrit.
   */
  async restoreAll(entries: WorkspaceData[], activeId: string): Promise<Result<void>> {
    const log: AuditLog = {
      action: 'restauration',
      entity: 'Sauvegarde',
      summary: 'Restauration d’une sauvegarde complète',
    };
    const plan = planRestore(
      entries,
      activeId,
      { main: this.#main, workspaces: this.#state.workspaces },
      this.#newId,
    );
    const copies = plan.steps.filter((step) => step.target === 'copy').map((step) => step.workspace);
    if (copies.length > 0) {
      const created = await this.#registry.createAll(copies);
      if (!created.ok) {
        return created;
      }
      copies.forEach((workspace) => this.#unconfirmed.set(workspace.id, workspace));
    }
    const displayed = this.#state.workspace;
    this.#stopWatchingDataset();
    await this.#repository.close();
    const workspaces = this.#withMain([...this.#state.workspaces, ...copies]);
    this.#set({ workspaces });
    for (const step of plan.steps) {
      const repository = this.#createRepository(step.workspace.id);
      const written = await repository.replaceAll({
        ...step.dataset,
        audit: [this.#auditEntry(log), ...step.dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
      });
      await repository.close();
      if (!written.ok) {
        await this.#open(displayed);
        return written;
      }
    }
    await this.#open(activeIn(workspaces, plan.activeId, this.#main));
    return ok(undefined);
  }
}
