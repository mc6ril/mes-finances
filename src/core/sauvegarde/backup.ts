import { fail, ok, type Result } from '../shared/errors';
import type { CollectionName, Dataset } from '../shared/model';
import { SCHEMA_VERSION } from '../shared/model';
import { migrateDataset } from './migrate';
import { isArray, isInteger, isObject, isString } from '@/core/shared/typeCheck';

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

const ID_FIELD: Partial<Record<CollectionName, string>> = {
  budgets: 'month',
  yearBudgets: 'year',
  monthNotes: 'month',
  commonMonths: 'month',
};

/** Collections apparues après coup : absentes des sauvegardes plus anciennes que cette version. */
const ADDED_IN: Partial<Record<CollectionName, number>> = {
  yearBudgets: 2,
  monthNotes: 6,
  commonMonths: 7,
  settlements: 7,
};

const invalidCollection = (data: Record<string, unknown>, schemaVersion: number): string | null => {
  const expected = [...COLLECTIONS, ...(Object.keys(ADDED_IN) as CollectionName[])];
  const broken = expected.find((name) => {
    const items = data[name];
    if (items === undefined && schemaVersion < (ADDED_IN[name] ?? 0)) {
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

/** Statuts admis selon la version du fichier : « rapproché » n'existe plus depuis la v12. */
const STATUSES_BEFORE_12 = ['prevu', 'realise', 'rapproche'];
const STATUSES = ['prevu', 'realise'];

const transactionsValid = (items: unknown, schemaVersion: number): boolean => {
  const statuses = schemaVersion < 12 ? STATUSES_BEFORE_12 : STATUSES;
  return (
    isArray(items) &&
    items.every(
      (item) =>
        isObject(item) &&
        isString(item.status) &&
        statuses.includes(item.status) &&
        (item.verified === undefined || typeof item.verified === 'boolean'),
    )
  );
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
  if (!transactionsValid(raw.data.transactions, raw.schemaVersion)) {
    return fail('backup-corrupted', { detail: 'transactions' });
  }
  if (!plannedAreIntegers(raw.data)) {
    return fail('backup-corrupted', { detail: 'budgets' });
  }
  return ok({
    dataset: migrateDataset({ ...(raw.data as Dataset), schemaVersion: raw.schemaVersion }),
    workspaceName: isString(raw.workspaceName) && raw.workspaceName.trim() ? raw.workspaceName.trim() : null,
  });
};
