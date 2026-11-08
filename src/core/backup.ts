import { fail, ok, type Result } from './errors';
import type { CollectionName, Dataset } from './model';
import { SCHEMA_VERSION } from './model';
import { migrateDataset } from './migrate';
import { isArray, isInteger, isObject, isString } from '@/utils/typeCheck';

export const BACKUP_APP_ID = 'mes-finances';

export type Backup = {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  workspaceName?: string;
  data: Dataset;
};

export type BackupContent = { dataset: Dataset; workspaceName: string | null };

export const createBackup = (dataset: Dataset, exportedAt: string, workspaceName?: string): Backup => ({
  app: BACKUP_APP_ID,
  schemaVersion: dataset.schemaVersion,
  exportedAt,
  ...(workspaceName ? { workspaceName } : {}),
  data: dataset,
});

const COLLECTIONS: CollectionName[] = [
  'accounts',
  'categories',
  'transactions',
  'savingsMovements',
  'valuations',
  'budgets',
  'recurrings',
  'goals',
  'audit',
];

const INTEGER_FIELDS: Partial<Record<CollectionName, string[]>> = {
  accounts: ['openingBalance'],
  transactions: ['amount'],
  savingsMovements: ['amount'],
  valuations: ['value'],
  recurrings: ['amount', 'dayOfMonth'],
  goals: ['targetAmount', 'initialAmount', 'monthlyContribution'],
};

const ID_FIELD: Partial<Record<CollectionName, string>> = { budgets: 'month', yearBudgets: 'year' };

const OPTIONAL_BEFORE_V2: CollectionName[] = ['yearBudgets'];

const invalidCollection = (data: Record<string, unknown>, schemaVersion: number): string | null => {
  const expected = [...COLLECTIONS, ...OPTIONAL_BEFORE_V2];
  const broken = expected.find((name) => {
    const items = data[name];
    if (items === undefined && schemaVersion < 2 && OPTIONAL_BEFORE_V2.includes(name)) {
      return false;
    }
    if (!isArray(items)) {
      return true;
    }
    const idField = ID_FIELD[name] ?? 'id';
    const integerFields = INTEGER_FIELDS[name] ?? [];
    return !items.every(
      (item) =>
        isObject(item) && isString(item[idField]) && integerFields.every((field) => isInteger(item[field])),
    );
  });
  return broken ?? null;
};

const plannedListValid = (items: unknown): boolean =>
  isArray(items) &&
  items.every(
    (budget) =>
      isObject(budget) && isObject(budget.planned) && Object.values(budget.planned).every(isInteger),
  );

const plannedAreIntegers = (data: Record<string, unknown>): boolean =>
  plannedListValid(data.budgets) && (data.yearBudgets === undefined || plannedListValid(data.yearBudgets));

export const readBackup = (raw: unknown): Result<BackupContent> => {
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID || !isObject(raw.data)) {
    return fail('backup-not-recognized');
  }
  if (!isInteger(raw.schemaVersion) || raw.schemaVersion > SCHEMA_VERSION) {
    return fail('backup-too-recent');
  }
  if (!isObject(raw.data.settings)) {
    return fail('backup-corrupted', { detail: 'settings' });
  }
  const broken = invalidCollection(raw.data, raw.schemaVersion);
  if (broken) {
    return fail('backup-corrupted', { detail: broken });
  }
  if (!plannedAreIntegers(raw.data)) {
    return fail('backup-corrupted', { detail: 'budgets' });
  }
  return ok({
    dataset: migrateDataset({ ...(raw.data as Dataset), schemaVersion: raw.schemaVersion }),
    workspaceName: isString(raw.workspaceName) && raw.workspaceName.trim() ? raw.workspaceName.trim() : null,
  });
};
