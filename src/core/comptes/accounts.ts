import { parseFlexibleDate } from '../shared/dates';
import { parseEuros } from '../shared/money';
import type { Account, AccountGroup, AccountKind, IsoDate } from '../shared/model';

const GROUP_BY_KIND: Record<AccountKind, AccountGroup> = {
  courant: 'courant',
  livret: 'securise',
  'assurance-vie': 'investissement',
  bourse: 'investissement',
  'commun-immo': 'securise',
  autre: 'securise',
};

/** Types proposés pour un compte d'épargne (page Épargne et patrimoine). */
export const SAVINGS_KINDS: AccountKind[] = ['livret', 'assurance-vie', 'bourse', 'commun-immo', 'autre'];

export const groupOfKind = (kind: AccountKind): AccountGroup => GROUP_BY_KIND[kind];

/**
 * Compte d'épargne ou de placement : se gère depuis Épargne et patrimoine. Les comptes du groupe
 * courant se gèrent dans Paramètres → Comptes.
 */
export const isSavingsAccount = (account: Pick<Account, 'group'>): boolean => account.group !== 'courant';

/** Comptes d'épargne et placements encore suivis (non archivés), comptes communs compris. */
export const activeSavingsAccounts = (accounts: Account[]): Account[] =>
  accounts.filter((account) => isSavingsAccount(account) && !account.archived);

/** Change le type d'un compte : le groupe et le caractère commun en découlent. */
export const withKind = (account: Account, kind: AccountKind): Account => ({
  ...account,
  kind,
  group: groupOfKind(kind),
  isJoint: kind === 'commun-immo',
});

type NewAccountFields = { name: string; kind: AccountKind; openingBalance: number; openingDate: IsoDate };

type SavingsAccountInput = { name: string; balance: string; date: string };

/** Saisie d'un compte d'épargne : nom requis, date lisible, solde de départ positif (vide = 0). */
export const validateSavingsAccount = ({
  name,
  balance,
  date,
}: SavingsAccountInput): Pick<Account, 'name' | 'openingBalance' | 'openingDate'> | null => {
  const openingDate = parseFlexibleDate(date);
  const openingBalance = balance.trim() === '' ? 0 : parseEuros(balance);
  if (!name.trim() || !openingDate || openingBalance === null || openingBalance < 0) {
    return null;
  }
  return { name: name.trim(), openingBalance, openingDate };
};

/** Brouillon d'un nouveau compte, prêt à enregistrer (l'identifiant est attribué à l'enregistrement). */
export const newAccountDraft = ({
  name,
  kind,
  openingBalance,
  openingDate,
}: NewAccountFields): Omit<Account, 'id'> => ({
  name,
  kind,
  group: groupOfKind(kind),
  openingBalance,
  openingDate,
  isJoint: kind === 'commun-immo',
  personalSharePercent: null,
  archived: false,
  color: '#64748b',
});
