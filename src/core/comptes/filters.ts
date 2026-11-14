import type { Account, Transaction } from '../shared/model';
import { isVerified } from './balances';

/** Filtre de statut de la page Opérations ('' = tous). */
export type StatusFilter = '' | 'prevu' | 'realise' | 'verifiee' | 'a-verifier';

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tous statuts' },
  { value: 'prevu', label: 'Prévu' },
  { value: 'realise', label: 'Passé' },
  { value: 'verifiee', label: 'Passé · vérifiée' },
  { value: 'a-verifier', label: 'Passé · à vérifier' },
];

export const matchesStatus = (transaction: Transaction, filter: string): boolean => {
  switch (filter) {
    case 'prevu':
    case 'realise':
      return transaction.status === filter;
    case 'verifiee':
      return isVerified(transaction);
    case 'a-verifier':
      return transaction.status === 'realise' && !isVerified(transaction);
    default:
      return true;
  }
};

/** Opération passée qui attend une catégorie : dépense ou revenu sans catégorie (les virements suivent leur compte). */
export const needsCategory = (transaction: Transaction): boolean =>
  transaction.status === 'realise' &&
  transaction.categoryId === null &&
  (transaction.type === 'depense' || transaction.type === 'revenu');

export type ToClassify = { count: number; accountId: string | null };

/**
 * Opérations à classer sur les comptes suivis, toutes dates confondues, et le compte qui en a
 * le plus (celui que la page Opérations affiche, filtrée « Sans catégorie »).
 */
export const toClassify = (transactions: Transaction[], accounts: Account[]): ToClassify => {
  const active = new Set(accounts.filter((account) => !account.archived).map((account) => account.id));
  const byAccount = new Map<string, number>();
  transactions
    .filter((transaction) => needsCategory(transaction) && active.has(transaction.accountId))
    .forEach((transaction) =>
      byAccount.set(transaction.accountId, (byAccount.get(transaction.accountId) ?? 0) + 1),
    );
  const count = [...byAccount.values()].reduce((total, value) => total + value, 0);
  const accountId = [...byAccount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { count, accountId };
};
