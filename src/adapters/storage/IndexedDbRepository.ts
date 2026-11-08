import { openDB, type IDBPDatabase } from 'idb';
import type { CollectionName, Dataset, Settings } from '@/core/model';
import { SCHEMA_VERSION } from '@/core/model';
import {
  failure,
  success,
  type CollectionItem,
  type FinanceRepositoryInterface,
  type PortFailure,
  type PortResult,
} from '@/core/ports';

const DB_VERSION = 2;
const META_STORE = 'meta';

const COLLECTION_KEYS: Record<CollectionName, string> = {
  accounts: 'id',
  categories: 'id',
  transactions: 'id',
  savingsMovements: 'id',
  valuations: 'id',
  budgets: 'month',
  yearBudgets: 'year',
  recurrings: 'id',
  goals: 'id',
  audit: 'id',
};

const COLLECTIONS = Object.keys(COLLECTION_KEYS) as CollectionName[];

const toFailure = (error: unknown): PortFailure => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return failure(
      'quota',
      'L’espace de stockage du navigateur est plein. Exporte une sauvegarde puis libère de la place.',
    );
  }
  if (
    error instanceof DOMException &&
    (error.name === 'InvalidStateError' || error.name === 'SecurityError')
  ) {
    return failure(
      'indisponible',
      'Le stockage local est indisponible (navigation privée ou stockage bloqué).',
    );
  }
  return failure('inconnu', 'Une erreur inattendue est survenue pendant l’enregistrement local.');
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
      });
    }
    return this.#db;
  }

  async #run<T>(operation: (db: IDBPDatabase) => Promise<T>): Promise<PortResult<T>> {
    try {
      const db = await this.#open();
      return success(await operation(db));
    } catch (error) {
      return toFailure(error);
    }
  }

  async load(): Promise<PortResult<Dataset | null>> {
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

  async saveSettings(settings: Settings): Promise<PortResult<void>> {
    return this.#run(async (db) => {
      await db.put(META_STORE, settings, 'settings');
    });
  }

  async put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<PortResult<void>> {
    return this.#run(async (db) => {
      const transaction = db.transaction(collection, 'readwrite');
      await Promise.all([...items.map((item) => transaction.store.put(item)), transaction.done]);
    });
  }

  async remove(collection: CollectionName, keys: string[]): Promise<PortResult<void>> {
    return this.#run(async (db) => {
      const transaction = db.transaction(collection, 'readwrite');
      await Promise.all([...keys.map((key) => transaction.store.delete(key)), transaction.done]);
    });
  }

  async replaceAll(dataset: Dataset): Promise<PortResult<void>> {
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
}
