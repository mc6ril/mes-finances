import {
  byteSize,
  fromShards,
  parseShardId,
  planLayout,
  planShardCount,
  shardId,
  shardIndex,
  toShards,
} from '@/adapters/firestore/sharding';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../../core/fixtures';

const itemsOf = (count: number, padding = 0) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `t${index}`,
      aTransaction({ id: `t${index}`, comment: 'x'.repeat(padding) }),
    ]),
  );

describe('identifiants des paquets', () => {
  it('nomme un paquet d’après sa collection et son numéro, et le relit', () => {
    expect(shardId('transactions', 3)).toBe('transactions__3');
    expect(parseShardId('transactions__3')).toEqual({ collection: 'transactions', index: 3 });
    expect(parseShardId('inconnue__0')).toBeNull();
    expect(parseShardId('transactions__x')).toBeNull();
    expect(parseShardId('transactions')).toBeNull();
  });

  it('range une clé toujours dans le même paquet, dans les bornes', () => {
    const keys = Array.from({ length: 500 }, (_, index) => `id-${index}`);
    keys.forEach((key) => {
      const index = shardIndex(key, 8);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
      expect(shardIndex(key, 8)).toBe(index);
    });
    expect(shardIndex('n’importe', 1)).toBe(0);
  });

  it('répartit les clés de façon équilibrée', () => {
    const counts = new Array(8).fill(0) as number[];
    for (let index = 0; index < 8000; index += 1) {
      const slot = shardIndex(`tx-${index}`, 8);
      counts[slot] = (counts[slot] ?? 0) + 1;
    }
    counts.forEach((count) => expect(count).toBeGreaterThan(800));
  });

  it('en doublant le nombre de paquets, une clé reste dans son paquet ou passe dans son jumeau', () => {
    for (let index = 0; index < 200; index += 1) {
      const key = `k${index}`;
      expect([shardIndex(key, 4), shardIndex(key, 4) + 4]).toContain(shardIndex(key, 8));
    }
  });
});

describe('taille des paquets', () => {
  it('mesure la taille en octets UTF-8', () => {
    expect(byteSize({ a: 'é' })).toBe('{"a":"é"}'.length + 1);
  });

  it('garde un seul paquet tant que la cible n’est pas atteinte', () => {
    expect(planShardCount(itemsOf(10), 256 * 1024)).toBe(1);
    expect(planShardCount({}, 256 * 1024)).toBe(1);
  });

  it('double le nombre de paquets jusqu’à ce que chacun tienne sous la cible', () => {
    const items = itemsOf(400, 200);
    const target = Math.ceil(byteSize(items) / 3);
    const count = planShardCount(items, target);
    expect([4, 8]).toContain(count);
    const shards = toShards(
      { ...createInitialDataset('2026-11-01', () => 'x'), transactions: Object.values(items) as never },
      { transactions: count },
    );
    shards
      .filter((shard) => shard.collection === 'transactions')
      .forEach((shard) => expect(byteSize(shard.items)).toBeLessThanOrEqual(target));
  });

  it('ne réduit jamais en dessous du minimum demandé', () => {
    expect(planShardCount(itemsOf(2), 256 * 1024, 4)).toBe(4);
  });
});

describe('découpage d’un jeu de données', () => {
  const dataset = {
    ...createInitialDataset('2026-11-01', () => 'audit-1'),
    transactions: Object.values(itemsOf(30)) as ReturnType<typeof aTransaction>[],
  };

  it('prévoit un paquet par collection pour un petit espace', () => {
    const layout = planLayout(dataset, 256 * 1024);
    expect(Object.values(layout).every((count) => count === 1)).toBe(true);
    expect(Object.keys(layout)).toHaveLength(13);
  });

  it('écrit tous les paquets, vides compris, et relit exactement les mêmes données', () => {
    const layout = { ...planLayout(dataset, 256 * 1024), transactions: 4 };
    const shards = toShards(dataset, layout);
    expect(shards).toHaveLength(12 + 4);
    expect(shards.find((shard) => shard.id === 'goals__0')?.items).toEqual({});
    const read = fromShards(shards, layout);
    expect(read.transactions.map((item) => item.id).sort()).toEqual(
      dataset.transactions.map((item) => item.id).sort(),
    );
    expect(read.categories).toEqual(dataset.categories);
    expect(read.budgets).toEqual(dataset.budgets);
  });

  it('ignore les paquets hors du découpage (anciens restes)', () => {
    const layout = { transactions: 1 };
    const read = fromShards(
      [
        { id: 'transactions__0', items: { a: aTransaction({ id: 'a' }) } },
        { id: 'transactions__1', items: { b: aTransaction({ id: 'b' }) } },
      ],
      layout,
    );
    expect(read.transactions.map((item) => item.id)).toEqual(['a']);
  });

  it('garde la version rangée dans le bon paquet quand un élément est en double', () => {
    const key = 'doublon';
    const right = shardIndex(key, 2);
    const wrong = 1 - right;
    const read = fromShards(
      [
        { id: `transactions__${wrong}`, items: { [key]: aTransaction({ id: key, label: 'ancienne' }) } },
        { id: `transactions__${right}`, items: { [key]: aTransaction({ id: key, label: 'bonne' }) } },
      ],
      { transactions: 2 },
    );
    expect(read.transactions.map((item) => item.label)).toEqual(['bonne']);
  });

  it('retire les propriétés indéfinies, refusées par la base', () => {
    const shards = toShards(
      { ...dataset, transactions: [aTransaction({ id: 'u', imputation: undefined })] },
      planLayout(dataset, 256 * 1024),
    );
    const item = shards.find((shard) => shard.collection === 'transactions')?.items.u as object;
    expect(Object.keys(item)).not.toContain('imputation');
  });
});
