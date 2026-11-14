import { COLLECTION_KEYS, COLLECTION_NAMES, itemKey } from '@/core/shared/collections';
import type { CollectionName, Dataset } from '@/core/shared/model';

/**
 * Répartition des collections en documents « paquets » (workspaces/{id}/data/{collection}__{n}),
 * pour qu'une ouverture coûte quelques dizaines de lectures au lieu d'une par élément (quota Spark).
 * Une clé va toujours dans le paquet hash(clé) mod n ; n est une puissance de 2 et ne fait que
 * doubler, si bien qu'une clé reste dans son paquet ou passe dans son jumeau.
 */

/** Nombre de paquets par collection, enregistré avec l'espace. */
export type Layout = Partial<Record<CollectionName, number>>;

export type ItemMap = Record<string, unknown>;

export type ShardDoc = { id: string; collection: CollectionName; index: number; items: ItemMap };

export type StoredShard = { id: string; items: ItemMap };

export type Collections = { [C in CollectionName]: Dataset[C] };

/** Taille visée par paquet à la création ou au redécoupage. */
export const SHARD_TARGET_BYTES = 256 * 1024;
/** Au-delà, la collection est redécoupée (un document Firestore est limité à 1 Mio). */
export const SHARD_SPLIT_BYTES = 640 * 1024;
const MAX_SHARDS = 1024;

const SEPARATOR = '__';

export const shardId = (collection: CollectionName, index: number): string =>
  `${collection}${SEPARATOR}${index}`;

export const parseShardId = (id: string): { collection: CollectionName; index: number } | null => {
  const at = id.lastIndexOf(SEPARATOR);
  if (at <= 0) {
    return null;
  }
  const collection = id.slice(0, at);
  const index = Number(id.slice(at + SEPARATOR.length));
  if (!(collection in COLLECTION_KEYS) || !Number.isInteger(index) || index < 0) {
    return null;
  }
  return { collection: collection as CollectionName, index };
};

/** FNV-1a 32 bits : stable d'un appareil et d'une version à l'autre. */
const hash = (key: string): number => {
  let value = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    value ^= key.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
};

export const shardIndex = (key: string, count: number): number => (count <= 1 ? 0 : hash(key) % count);

const encoder = new TextEncoder();

export const byteSize = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

/** Copie sans propriétés indéfinies (refusées par Firestore). */
export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const splitItems = (items: ItemMap, count: number): ItemMap[] => {
  const shards = Array.from({ length: count }, (): ItemMap => ({}));
  Object.entries(items).forEach(([key, item]) => {
    const shard = shards[shardIndex(key, count)];
    if (shard) {
      shard[key] = item;
    }
  });
  return shards;
};

/** Plus petit nombre de paquets (puissance de 2, au moins `minimum`) dont chacun tient sous la cible. */
export const planShardCount = (items: ItemMap, targetBytes: number, minimum = 1): number => {
  let count = 1;
  while (count < minimum) {
    count *= 2;
  }
  while (count < MAX_SHARDS && splitItems(items, count).some((shard) => byteSize(shard) > targetBytes)) {
    count *= 2;
  }
  return count;
};

export const collectionItems = (collection: CollectionName, items: readonly object[]): ItemMap =>
  Object.fromEntries(items.map((item) => [itemKey(collection, item), plain(item)]));

export const planLayout = (dataset: Dataset, targetBytes: number, minimum: Layout = {}): Layout =>
  Object.fromEntries(
    COLLECTION_NAMES.map((collection) => [
      collection,
      planShardCount(collectionItems(collection, dataset[collection]), targetBytes, minimum[collection] ?? 1),
    ]),
  );

export const shardsOf = (collection: CollectionName, items: ItemMap, count: number): ShardDoc[] =>
  splitItems(items, count).map((shardItems, index) => ({
    id: shardId(collection, index),
    collection,
    index,
    items: shardItems,
  }));

/** Tous les paquets de l'espace, vides compris (les écritures suivantes les supposent présents). */
export const toShards = (dataset: Dataset, layout: Layout): ShardDoc[] =>
  COLLECTION_NAMES.flatMap((collection) =>
    shardsOf(collection, collectionItems(collection, dataset[collection]), layout[collection] ?? 1),
  );

/**
 * Relit les collections. Les paquets hors découpage (restes d'un découpage plus fin) sont ignorés ;
 * un élément présent dans deux paquets (écriture concurrente d'un redécoupage) garde la version
 * rangée dans son paquet attendu.
 */
export const fromShards = (shards: StoredShard[], layout: Layout): Collections => {
  const found = new Map<CollectionName, Map<string, { item: unknown; expected: boolean }>>();
  shards.forEach((shard) => {
    const parsed = parseShardId(shard.id);
    if (!parsed) {
      return;
    }
    const count = layout[parsed.collection] ?? 1;
    if (parsed.index >= count) {
      return;
    }
    const items = found.get(parsed.collection) ?? new Map<string, { item: unknown; expected: boolean }>();
    found.set(parsed.collection, items);
    Object.entries(shard.items ?? {}).forEach(([key, item]) => {
      const expected = shardIndex(key, count) === parsed.index;
      const previous = items.get(key);
      if (!previous || (expected && !previous.expected)) {
        items.set(key, { item, expected });
      }
    });
  });
  return Object.fromEntries(
    COLLECTION_NAMES.map((collection) => [
      collection,
      [...(found.get(collection)?.values() ?? [])].map((entry) => entry.item),
    ]),
  ) as Collections;
};
