import { ok, type Result } from '@/core/shared/errors';
import type { CollectionName, Dataset, Settings } from '@/core/shared/model';
import type { AuditLog, CollectionItem, FinanceGatewayInterface } from '@/core/shared/ports';

export type GatewayCall =
  | { kind: 'upsert'; collection: CollectionName; items: unknown[]; log: AuditLog }
  | { kind: 'remove'; collection: CollectionName; keys: string[]; log: AuditLog }
  | { kind: 'settings'; patch: Partial<Settings>; log: AuditLog | null }
  | { kind: 'restore'; dataset: Dataset; log: AuditLog };

export const fakeGateway = (dataset: Dataset | null, failWith: Result<void> | null = null) => {
  const calls: GatewayCall[] = [];
  const answer = (): Result<void> => failWith ?? ok(undefined);
  const gateway: FinanceGatewayInterface = {
    currentDataset: () => dataset,
    upsert: async <C extends CollectionName>(collection: C, items: CollectionItem<C>[], log: AuditLog) => {
      calls.push({ kind: 'upsert', collection, items, log });
      return answer();
    },
    remove: async (collection, keys, log) => {
      calls.push({ kind: 'remove', collection, keys, log });
      return answer();
    },
    updateSettings: async (patch, log) => {
      calls.push({ kind: 'settings', patch, log });
      return answer();
    },
    restore: async (restored, log) => {
      calls.push({ kind: 'restore', dataset: restored, log });
      return answer();
    },
  };
  return { gateway, calls };
};

export const sequentialIds = () => {
  let counter = 0;
  return () => {
    counter += 1;
    return `id-${counter}`;
  };
};

export const fixedClock =
  (iso = '2026-11-08T10:00:00.000Z') =>
  () =>
    new Date(iso);
