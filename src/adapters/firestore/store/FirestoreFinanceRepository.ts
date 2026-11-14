import {
  collection,
  deleteField,
  doc,
  FieldPath,
  getDocs,
  onSnapshot,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { COLLECTION_NAMES, itemKey } from '@/core/shared/collections';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { AuditEntry, CollectionName, Dataset, Settings } from '@/core/shared/model';
import type { CollectionItem, DatasetListener, FinanceRepositoryInterface } from '@/core/store/interface';
import { toSyncFailure } from '@/adapters/firestore/firestoreErrors';
import {
  byteSize,
  fromShards,
  plain,
  planLayout,
  planShardCount,
  SHARD_SPLIT_BYTES,
  SHARD_TARGET_BYTES,
  shardId,
  shardIndex,
  shardsOf,
  toShards,
  type ItemMap,
  type Layout,
} from './sharding';
import type { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';

export type RepositoryOptions = {
  /** Taille visée par paquet (redécoupage). */
  targetBytes?: number;
  /** Taille au-delà de laquelle une collection est redécoupée. */
  splitBytes?: number;
  /** Attente maximale des données quand l'appareil n'en a pas encore de copie. */
  readyTimeoutMs?: number;
};

type WorkspaceFields = { settings?: Settings; schemaVersion?: number; layout?: Layout };

type Snapshot<T> = { value: T; fromCache: boolean; pending: boolean };

const MAX_BATCH_WRITES = 450;
const READY_TIMEOUT_MS = 15000;
/**
 * Un espace tout juste créé peut être écouté avant que le serveur ait reçu sa création : le refus
 * qui en résulte n'est pas définitif, l'écoute est relancée quelques fois avant de conclure.
 */
const LISTEN_RETRY_DELAYS_MS = [300, 800, 1500];

const byKey = (a: { key: string }, b: { key: string }): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

const newestFirst = (a: AuditEntry, b: AuditEntry): number =>
  a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? 1 : -1;

/**
 * Espace de suivi dans Firestore : workspaces/{id} (réglages, version, découpage) et ses paquets
 * workspaces/{id}/data/{collection}__{n}. Les écritures sont mises en file (cache local persistant)
 * et confirmées en arrière-plan : elles continuent hors ligne.
 */
export class FirestoreFinanceRepository implements FinanceRepositoryInterface {
  readonly #db: Firestore;
  readonly #ref: DocumentReference;
  readonly #monitor: SyncMonitor;
  readonly #targetBytes: number;
  readonly #splitBytes: number;
  readonly #readyTimeoutMs: number;
  #workspace: Snapshot<WorkspaceFields | null> | null = null;
  #data: Snapshot<null> | null = null;
  #shards = new Map<string, ItemMap>();
  #listeners = new Set<DatasetListener>();
  #unsubscribe: (() => void)[] = [];
  #ready: Promise<Result<Dataset | null>> | null = null;
  #settleReady: ((result: Result<Dataset | null>) => void) | null = null;
  #delivered: string | null = null;
  #listenAttempts = 0;

  constructor(db: Firestore, documentId: string, monitor: SyncMonitor, options: RepositoryOptions = {}) {
    this.#db = db;
    this.#ref = doc(db, 'workspaces', documentId);
    this.#monitor = monitor;
    this.#targetBytes = options.targetBytes ?? SHARD_TARGET_BYTES;
    this.#splitBytes = options.splitBytes ?? SHARD_SPLIT_BYTES;
    this.#readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT_MS;
  }

  #shardRef(id: string): DocumentReference {
    return doc(this.#ref, 'data', id);
  }

  get #layout(): Layout {
    return this.#workspace?.value?.layout ?? {};
  }

  #count(collection: CollectionName): number {
    return this.#layout[collection] ?? 1;
  }

  // ——— Lecture et écoute ———

  /** Ouvre l'écoute de l'espace et attend un état fiable (copie locale complète ou réponse du serveur). */
  load(): Promise<Result<Dataset | null>> {
    if (!this.#ready) {
      this.#ready = new Promise((resolve) => {
        this.#settleReady = resolve;
      });
      this.#listen();
      setTimeout(() => this.#resolveReady(fail('sync-offline')), this.#readyTimeoutMs);
    }
    return this.#ready;
  }

  #listen(): void {
    const options = { includeMetadataChanges: true };
    this.#unsubscribe.push(
      onSnapshot(
        this.#ref,
        options,
        (snapshot) => {
          this.#workspace = {
            value: snapshot.exists() ? (snapshot.data() as WorkspaceFields) : null,
            fromCache: snapshot.metadata.fromCache,
            pending: snapshot.metadata.hasPendingWrites,
          };
          this.#changed();
        },
        (error) => this.#failed(error),
      ),
      onSnapshot(
        collection(this.#ref, 'data'),
        options,
        (snapshot) => {
          this.#shards = new Map(
            snapshot.docs.map((shard) => [
              shard.id,
              ((shard.data() as { items?: ItemMap }).items ?? {}) as ItemMap,
            ]),
          );
          this.#data = {
            value: null,
            fromCache: snapshot.metadata.fromCache,
            pending: snapshot.metadata.hasPendingWrites,
          };
          this.#changed();
        },
        (error) => this.#failed(error),
      ),
    );
  }

  #failed(error: unknown): void {
    if (this.#settleReady) {
      const failure = toSyncFailure(error);
      const delay = LISTEN_RETRY_DELAYS_MS[this.#listenAttempts];
      if (failure.error.code === 'sync-permission-denied' && delay !== undefined) {
        this.#listenAttempts += 1;
        this.#stopListening();
        setTimeout(() => {
          if (this.#settleReady) {
            this.#listen();
          }
        }, delay);
        return;
      }
      this.#resolveReady(failure);
      return;
    }
    // Accès retiré : la liste des espaces le signale déjà et ramène sur l'espace principal.
    if (toSyncFailure(error).error.code !== 'sync-permission-denied') {
      this.#monitor.report(error);
    }
  }

  #resolveReady(result: Result<Dataset | null>): void {
    const settle = this.#settleReady;
    if (!settle) {
      return;
    }
    this.#settleReady = null;
    if (result.ok) {
      this.#delivered = result.value ? JSON.stringify(result.value) : null;
    }
    settle(result);
  }

  /** Une copie locale sans réglages ou incomplète n'est pas fiable : on attend le serveur. */
  #readyState(): Result<Dataset | null> | null {
    const workspace = this.#workspace;
    const data = this.#data;
    if (!workspace || !data) {
      return null;
    }
    if (!workspace.value?.settings) {
      return workspace.fromCache ? null : ok(null);
    }
    const complete = COLLECTION_NAMES.every((name) =>
      Array.from({ length: this.#count(name) }, (_, index) => shardId(name, index)).every((id) =>
        this.#shards.has(id),
      ),
    );
    if (data.fromCache && !complete) {
      return null;
    }
    return ok(this.#dataset());
  }

  #changed(): void {
    if (this.#settleReady) {
      const state = this.#readyState();
      if (state) {
        this.#resolveReady(state);
      }
      return;
    }
    // Les instantanés avec écritures locales en attente reflètent ce que le store vient d'écrire.
    if (this.#workspace?.pending || this.#data?.pending) {
      return;
    }
    this.#deliver();
  }

  #deliver(): void {
    if (!this.#workspace?.value?.settings || this.#listeners.size === 0) {
      return;
    }
    const dataset = this.#dataset();
    const signature = JSON.stringify(dataset);
    if (signature === this.#delivered) {
      return;
    }
    this.#delivered = signature;
    this.#listeners.forEach((listener) => listener(dataset));
  }

  #dataset(): Dataset {
    const workspace = this.#workspace?.value ?? {};
    const collections = fromShards(
      [...this.#shards].map(([id, items]) => ({ id, items })),
      this.#layout,
    );
    const sorted = Object.fromEntries(
      COLLECTION_NAMES.map((name) => {
        const items = collections[name] as unknown as Record<string, unknown>[];
        if (name === 'audit') {
          return [name, [...(items as unknown as AuditEntry[])].sort(newestFirst)];
        }
        return [name, sortByKey(name, items)];
      }),
    );
    return {
      schemaVersion: workspace.schemaVersion ?? 0,
      settings: workspace.settings as Settings,
      ...sorted,
    } as Dataset;
  }

  watch(listener: DatasetListener): () => void {
    this.#listeners.add(listener);
    if (!this.#settleReady && !this.#workspace?.pending && !this.#data?.pending) {
      this.#deliver();
    }
    return () => this.#listeners.delete(listener);
  }

  // ——— Écritures ———

  #commit(batches: WriteBatch[]): void {
    batches.forEach((batch) => this.#monitor.track(batch.commit()));
  }

  #attempt(write: () => void): Result<void> {
    try {
      write();
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  /** Paquets de la collection (dans le découpage) qui contiennent la clé, hors paquet attendu. */
  #strayShards(collection: CollectionName, key: string, expected: string): string[] {
    return Array.from({ length: this.#count(collection) }, (_, index) => shardId(collection, index)).filter(
      (id) => id !== expected && this.#shards.get(id)?.[key] !== undefined,
    );
  }

  /** Écrit (ou supprime, valeur null) des éléments à leur place, en retirant les doublons égarés. */
  #changes(collection: CollectionName, entries: [string, unknown][]): Map<string, Map<string, unknown>> {
    const count = this.#count(collection);
    const changes = new Map<string, Map<string, unknown>>();
    const set = (id: string, key: string, value: unknown) => {
      const shard = changes.get(id) ?? new Map<string, unknown>();
      shard.set(key, value);
      changes.set(id, shard);
    };
    entries.forEach(([key, value]) => {
      const expected = shardId(collection, shardIndex(key, count));
      set(expected, key, value);
      this.#strayShards(collection, key, expected).forEach((id) => set(id, key, null));
    });
    return changes;
  }

  #applyLocally(changes: Map<string, Map<string, unknown>>): void {
    changes.forEach((values, id) => {
      const items = { ...(this.#shards.get(id) ?? {}) };
      values.forEach((value, key) => {
        if (value === null) {
          delete items[key];
        } else {
          items[key] = value;
        }
      });
      this.#shards.set(id, items);
    });
  }

  #writeChanges(changes: Map<string, Map<string, unknown>>): void {
    const batch = writeBatch(this.#db);
    changes.forEach((values, id) => {
      const items = Object.fromEntries(
        [...values].map(([key, value]) => [key, value === null ? deleteField() : value]),
      );
      const fields = [...values.keys()].map((key) => new FieldPath('items', key));
      batch.set(this.#shardRef(id), { items }, { mergeFields: fields });
    });
    this.#applyLocally(changes);
    this.#commit([batch]);
  }

  #collectionItems(collection: CollectionName): ItemMap {
    return Object.assign(
      {},
      ...Array.from(
        { length: this.#count(collection) },
        (_, index) => this.#shards.get(shardId(collection, index)) ?? {},
      ),
    ) as ItemMap;
  }

  /** Réécrit toute la collection sur un découpage plus fin (lot atomique avec le nouveau découpage). */
  #reshard(collection: CollectionName, items: ItemMap): void {
    const count = planShardCount(items, this.#targetBytes, this.#count(collection) * 2);
    const batch = writeBatch(this.#db);
    const shards = shardsOf(collection, items, count);
    shards.forEach((shard) => batch.set(this.#shardRef(shard.id), { items: shard.items }));
    batch.update(this.#ref, new FieldPath('layout', collection), count);
    shards.forEach((shard) => this.#shards.set(shard.id, shard.items));
    if (this.#workspace?.value) {
      this.#workspace.value.layout = { ...this.#layout, [collection]: count };
    }
    this.#commit([batch]);
  }

  async put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<Result<void>> {
    return this.#attempt(() => {
      const entries = items.map((item): [string, unknown] => [itemKey(collection, item), plain(item)]);
      const changes = this.#changes(collection, entries);
      const tooBig = [...changes].some(([id, values]) => {
        const projected = { ...(this.#shards.get(id) ?? {}), ...Object.fromEntries(values) };
        return byteSize(projected) > this.#splitBytes;
      });
      if (tooBig) {
        this.#reshard(collection, { ...this.#collectionItems(collection), ...Object.fromEntries(entries) });
        return;
      }
      this.#writeChanges(changes);
    });
  }

  async remove(collection: CollectionName, keys: string[]): Promise<Result<void>> {
    return this.#attempt(() => {
      this.#writeChanges(
        this.#changes(
          collection,
          keys.map((key) => [key, null]),
        ),
      );
    });
  }

  async saveSettings(settings: Settings): Promise<Result<void>> {
    return this.#attempt(() => {
      const batch = writeBatch(this.#db);
      batch.update(this.#ref, { settings: plain(settings) });
      if (this.#workspace?.value) {
        this.#workspace.value.settings = settings;
      }
      this.#commit([batch]);
    });
  }

  /** Remplace tout l'espace : découpage recalculé, tous les paquets réécrits (vides compris). */
  async replaceAll(dataset: Dataset): Promise<Result<void>> {
    return this.#attempt(() => {
      const layout = planLayout(dataset, this.#targetBytes);
      const shards = toShards(dataset, layout);
      const batches: WriteBatch[] = [];
      for (let start = 0; start < shards.length; start += MAX_BATCH_WRITES) {
        const batch = writeBatch(this.#db);
        shards
          .slice(start, start + MAX_BATCH_WRITES)
          .forEach((shard) => batch.set(this.#shardRef(shard.id), { items: shard.items }));
        batches.push(batch);
      }
      // Les réglages en dernier : l'espace n'est complet qu'une fois tous les paquets écrits.
      const last = batches.at(-1) ?? writeBatch(this.#db);
      last.update(this.#ref, {
        settings: plain(dataset.settings),
        schemaVersion: dataset.schemaVersion,
        layout,
      });
      if (batches.length === 0) {
        batches.push(last);
      }
      this.#shards = new Map(shards.map((shard) => [shard.id, shard.items]));
      this.#workspace = {
        value: {
          ...(this.#workspace?.value ?? {}),
          settings: dataset.settings,
          schemaVersion: dataset.schemaVersion,
          layout,
        },
        fromCache: false,
        pending: true,
      };
      this.#commit(batches);
    });
  }

  /** Efface les paquets de l'espace (le document de l'espace est retiré par la liste des espaces). */
  async destroy(): Promise<Result<void>> {
    await this.close();
    try {
      const shards = await getDocs(collection(this.#ref, 'data'));
      const ids = shards.docs.map((shard) => shard.id);
      const batches: WriteBatch[] = [];
      for (let start = 0; start < ids.length; start += MAX_BATCH_WRITES) {
        const batch = writeBatch(this.#db);
        ids.slice(start, start + MAX_BATCH_WRITES).forEach((id) => batch.delete(this.#shardRef(id)));
        batches.push(batch);
      }
      this.#commit(batches);
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  #stopListening(): void {
    this.#unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.#unsubscribe = [];
  }

  async close(): Promise<void> {
    this.#stopListening();
    this.#listeners.clear();
    this.#resolveReady(fail('sync-failed'));
  }
}

/** Ordre de la clé, comme le faisait IndexedDB : stable d'un appareil à l'autre. */
const sortByKey = (collection: CollectionName, items: Record<string, unknown>[]): Record<string, unknown>[] =>
  items
    .map((item) => ({ key: itemKey(collection, item), item }))
    .sort(byKey)
    .map((entry) => entry.item);
