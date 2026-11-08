import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import type { CollectionName, Dataset, Settings } from '@/core/shared/model';
import { SCHEMA_VERSION } from '@/core/shared/model';
import { fail, ok, type Failure, type Result } from '@/core/shared/errors';
import type { CollectionItem, FinanceRepositoryInterface } from '@/core/shared/ports';

const DB_VERSION = 3;
const META_STORE = 'meta';

const COLLECTION_KEYS: Record<CollectionName, string> = {
  accounts: 'id',
  categories: 'id',
  transactions: 'id',
  savingsMovements: 'id',
  valuations: 'id',
  budgets: 'month',
  yearBudgets: 'year',
  monthNotes: 'month',
  recurrings: 'id',
  goals: 'id',
  audit: 'id',
};

const COLLECTIONS = Object.keys(COLLECTION_KEYS) as CollectionName[];

const toFailure = (error: unknown): Failure => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return fail('storage-full');
  }
  if (
    error instanceof DOMException &&
    (error.name === 'InvalidStateError' || error.name === 'SecurityError')
  ) {
    return fail('storage-unavailable');
  }
  return fail('storage-failed');
};

export class IndexedDbRepository implements FinanceRepositoryInterface {
  #name: string;
  #db: Promise<IDBPDatabase> | null = null;

  constructor(name: string) {
    this.#name = name;
  }

  #open(): Promise<IDBPDatabase> {
    if (!this.#db) {
      this.#db = openDB(this.#name, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE);
          }
          COLLECTIONS.forEach((collection) => {
            if (!db.objectStoreNames.contains(collection)) {
              db.createObjectStore(collection, { keyPath: COLLECTION_KEYS[collection] });
            }
          });
        },
        blocking: () => {
          void this.close();
        },
      });
    }
    return this.#db;
  }

  async #run<T>(operation: (db: IDBPDatabase) => Promise<T>): Promise<Result<T>> {
    try {
      const db = await this.#open();
      return ok(await operation(db));
    } catch (error) {
      return toFailure(error);
    }
  }

  async load(): Promise<Result<Dataset | null>> {
    return this.#run(async (db) => {
      const settings = (await db.get(META_STORE, 'settings')) as Settings | undefined;
      if (!settings) {
        return null;
      }
      const schemaVersion =
        ((await db.get(META_STORE, 'schemaVersion')) as number | undefined) ?? SCHEMA_VERSION;
      const entries = await Promise.all(
        COLLECTIONS.map(async (collection) => [collection, await db.getAll(collection)] as const),
      );
      return { schemaVersion, settings, ...Object.fromEntries(entries) } as Dataset;
    });
  }

  async saveSettings(settings: Settings): Promise<Result<void>> {
    return this.#run(async (db) => {
      await db.put(META_STORE, settings, 'settings');
    });
  }

  async put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<Result<void>> {
    return this.#run(async (db) => {
      const transaction = db.transaction(collection, 'readwrite');
      await Promise.all([...items.map((item) => transaction.store.put(item)), transaction.done]);
    });
  }

  async remove(collection: CollectionName, keys: string[]): Promise<Result<void>> {
    return this.#run(async (db) => {
      const transaction = db.transaction(collection, 'readwrite');
      await Promise.all([...keys.map((key) => transaction.store.delete(key)), transaction.done]);
    });
  }

  async replaceAll(dataset: Dataset): Promise<Result<void>> {
    return this.#run(async (db) => {
      const transaction = db.transaction([META_STORE, ...COLLECTIONS], 'readwrite');
      const writes = COLLECTIONS.flatMap((collection) => {
        const store = transaction.objectStore(collection);
        const items = dataset[collection] as CollectionItem<typeof collection>[];
        return [store.clear(), ...items.map((item) => store.put(item))];
      });
      const meta = transaction.objectStore(META_STORE);
      await Promise.all([
        ...writes,
        meta.put(dataset.settings, 'settings'),
        meta.put(dataset.schemaVersion, 'schemaVersion'),
        transaction.done,
      ]);
    });
  }

  async close(): Promise<void> {
    if (!this.#db) {
      return;
    }
    const pending = this.#db;
    this.#db = null;
    try {
      (await pending).close();
    } catch {
      return;
    }
  }

  async destroy(): Promise<Result<void>> {
    try {
      await this.close();
      await deleteDB(this.#name);
      return ok(undefined);
    } catch (error) {
      return toFailure(error);
    }
  }
}
