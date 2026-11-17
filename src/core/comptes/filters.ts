import { monthEnd, monthStart } from '../shared/dates';
import { parseEuros } from '../shared/money';
import type { Account, IsoDate, MonthKey, Transaction } from '../shared/model';
import { isVerified, signedEffectOn } from './balances';

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

/** Valeur d'un filtre de liste qui ne restreint rien. */
export const ALL = '';

/** Filtre de catégorie « À classer » (voir needsCategory). */
export const TO_CLASSIFY = 'a-classer';

/** Critères de la page Opérations, tels que saisis (montants en texte). */
export type TransactionFilters = {
  from: IsoDate;
  to: IsoDate;
  search: string;
  categoryId: string;
  type: string;
  status: string;
  minAmount: string;
  maxAmount: string;
};

/** Minuscules sans accents, pour une recherche tolérante. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const matchesCategory = (transaction: Transaction, categoryId: string): boolean => {
  if (categoryId === ALL) {
    return true;
  }
  if (categoryId === TO_CLASSIFY) {
    return needsCategory(transaction);
  }
  return (transaction.categoryId ?? 'none') === categoryId;
};

/** Montant vu depuis le compte, en valeur absolue ; un montant illisible ne filtre pas. */
const matchesAmount = (transaction: Transaction, accountId: string, min: string, max: string): boolean => {
  const value = Math.abs(signedEffectOn(accountId, transaction));
  const minimum = parseEuros(min);
  const maximum = parseEuros(max);
  return (minimum === null || value >= minimum) && (maximum === null || value <= maximum);
};

/** Opérations d'un compte (ou dont il est la contrepartie) qui répondent à tous les critères. */
export const filterTransactions = (
  transactions: Transaction[],
  accountId: string,
  filters: TransactionFilters,
): Transaction[] => {
  const search = normalize(filters.search.trim());
  return transactions
    .filter(
      (transaction) => transaction.accountId === accountId || transaction.counterpartAccountId === accountId,
    )
    .filter((transaction) => transaction.date >= filters.from && transaction.date <= filters.to)
    .filter(
      (transaction) => !search || normalize(`${transaction.label} ${transaction.comment}`).includes(search),
    )
    .filter((transaction) => matchesCategory(transaction, filters.categoryId))
    .filter((transaction) => filters.type === ALL || transaction.type === filters.type)
    .filter((transaction) => matchesStatus(transaction, filters.status))
    .filter((transaction) => matchesAmount(transaction, accountId, filters.minAmount, filters.maxAmount));
};

/** Période couvrant les opérations à classer d'un compte (vue « à classer », toutes dates), sinon le mois. */
export const toClassifyRange = (
  transactions: Transaction[],
  accountId: string,
  month: MonthKey,
): { from: IsoDate; to: IsoDate } => {
  const dates = transactions
    .filter((transaction) => transaction.accountId === accountId && needsCategory(transaction))
    .map((transaction) => transaction.date)
    .sort();
  return { from: dates[0] ?? monthStart(month), to: dates.at(-1) ?? monthEnd(month) };
};

type DefaultFiltersInput = {
  transactions: Transaction[];
  accountId: string;
  month: MonthKey;
  /** Vue « à classer » : toutes dates, filtrée sur les opérations sans catégorie. */
  toClassify: boolean;
};

/** Filtres à l'ouverture de la page : le mois affiché, ou les opérations à classer. */
export const defaultFilters = ({
  transactions,
  accountId,
  month,
  toClassify,
}: DefaultFiltersInput): TransactionFilters => ({
  ...(toClassify
    ? toClassifyRange(transactions, accountId, month)
    : { from: monthStart(month), to: monthEnd(month) }),
  search: '',
  categoryId: toClassify ? TO_CLASSIFY : ALL,
  type: ALL,
  status: ALL,
  minAmount: '',
  maxAmount: '',
});
