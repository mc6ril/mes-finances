import { createInitialDataset } from '@/core/seed';
import { createDemoDataset } from '@/core/demo';
import { migrateDataset } from '@/core/migrate';
import { settleDuePlanned } from '@/core/planned';
import { todayIso } from '@/core/dates';
import type { AuditAction, AuditEntry, CollectionName, Dataset, Settings } from '@/core/model';
import { SCHEMA_VERSION } from '@/core/model';
import { orderCategories } from '@/core/categoryOrder';
import type { CollectionItem, FinanceRepositoryInterface, PortResult } from '@/core/ports';

export type StoreStatus = 'loading' | 'ready' | 'error';

export type StoreState = {
  status: StoreStatus;
  dataset: Dataset | null;
  error: string | null;
  isDemo: boolean;
};

type Listener = () => void;

type RepositoryFactory = (isDemo: boolean) => FinanceRepositoryInterface;

type ChangeLog = { action: AuditAction; entity: string; summary: string };

const MAX_AUDIT_ENTRIES = 500;

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
  upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: ChangeLog,
  ): Promise<PortResult<void>>;
  remove(collection: CollectionName, keys: string[], log: ChangeLog): Promise<PortResult<void>>;
  updateSettings(patch: Partial<Settings>, log: ChangeLog | null): Promise<PortResult<void>>;
  restore(dataset: Dataset, log: ChangeLog): Promise<PortResult<void>>;
  setDemo(isDemo: boolean): Promise<void>;
}

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

  constructor(
    createRepository: RepositoryFactory,
    isDemo: boolean,
    newId: () => string,
    now: () => Date = () => new Date(),
  ) {
    this.#createRepository = createRepository;
    this.#repository = createRepository(isDemo);
    this.#state = { status: 'loading', dataset: null, error: null, isDemo };
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

  async start(): Promise<void> {
    this.#set({ status: 'loading', error: null });
    const loaded = await this.#repository.load();
    if (!loaded.ok) {
      this.#set({ status: 'error', error: loaded.message });
      return;
    }
    if (loaded.value) {
      await this.#openExisting(loaded.value);
      await this.settleDue();
      return;
    }
    const today = todayIso(this.#now());
    const seed = this.#state.isDemo ? createDemoDataset(today) : createInitialDataset(today, this.#newId);
    const saved = await this.#repository.replaceAll(seed);
    if (!saved.ok) {
      this.#set({ status: 'error', error: saved.message });
      return;
    }
    this.#set({ status: 'ready', dataset: seed });
  }

  async settleDue(): Promise<void> {
    const dataset = this.#state.dataset;
    if (!dataset) {
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
    if (collection === 'transactions') {
      await this.settleDue();
    }
    return result;
  }

  async remove(collection: CollectionName, keys: string[], log: ChangeLog): Promise<PortResult<void>> {
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
    const withAudit = {
      ...dataset,
      audit: [this.#auditEntry(log), ...dataset.audit].slice(0, MAX_AUDIT_ENTRIES),
    };
    const result = await this.#repository.replaceAll(withAudit);
    if (result.ok) {
      this.#set({ dataset: withAudit });
      await this.settleDue();
    }
    return result;
  }

  async setDemo(isDemo: boolean): Promise<void> {
    this.#repository = this.#createRepository(isDemo);
    this.#set({ isDemo, dataset: null });
    await this.start();
  }
}
