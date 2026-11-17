import type { Transaction } from '../shared/model';
import { signedEffectOn } from './balances';

/** Colonne de tri de la page Opérations. */
export type SortKey = 'date' | 'label' | 'amount' | 'category';
export type SortState = { key: SortKey; direction: 1 | -1 };

/** Les plus récentes d'abord. */
export const DEFAULT_SORT: SortState = { key: 'date', direction: -1 };

const sortValue = (
  transaction: Transaction,
  key: SortKey,
  accountId: string,
  categoryNames: Map<string, string>,
): string | number => {
  const values: Record<SortKey, () => string | number> = {
    date: () => transaction.date,
    label: () => transaction.label.toLowerCase(),
    amount: () => signedEffectOn(accountId, transaction),
    category: () => categoryNames.get(transaction.categoryId ?? '') ?? '',
  };
  return values[key]();
};

/** Copie triée ; à égalité, la dernière créée d'abord, quel que soit le sens. */
export const sortTransactions = (
  transactions: Transaction[],
  sort: SortState,
  accountId: string,
  categoryNames: Map<string, string>,
): Transaction[] =>
  [...transactions].sort((a, b) => {
    const left = sortValue(a, sort.key, accountId, categoryNames);
    const right = sortValue(b, sort.key, accountId, categoryNames);
    if (left === right) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return (left < right ? -1 : 1) * sort.direction;
  });

/** Un clic sur la colonne déjà triée inverse le sens ; une autre colonne part du décroissant. */
export const nextSort = (current: SortState, key: SortKey): SortState => {
  if (current.key === key) {
    return { key, direction: current.direction === 1 ? -1 : 1 };
  }
  return { key, direction: -1 };
};
