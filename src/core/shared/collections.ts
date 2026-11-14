import type { CollectionName } from './model';

/** Champ qui identifie un élément dans chaque collection. */
export const COLLECTION_KEYS = {
  accounts: 'id',
  categories: 'id',
  transactions: 'id',
  savingsMovements: 'id',
  valuations: 'id',
  budgets: 'month',
  yearBudgets: 'year',
  monthNotes: 'month',
  commonMonths: 'month',
  settlements: 'id',
  recurrings: 'id',
  goals: 'id',
  audit: 'id',
} as const satisfies Record<CollectionName, 'id' | 'month' | 'year'>;

export const COLLECTION_NAMES = Object.keys(COLLECTION_KEYS) as CollectionName[];

export const itemKey = (collection: CollectionName, item: object): string =>
  String((item as Record<string, unknown>)[COLLECTION_KEYS[collection]]);
