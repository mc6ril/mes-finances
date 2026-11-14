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

/** Change le type d'un compte : le groupe et le caractère commun en découlent. */
export const withKind = (account: Account, kind: AccountKind): Account => ({
  ...account,
  kind,
  group: groupOfKind(kind),
  isJoint: kind === 'commun-immo',
});

type NewAccountFields = { name: string; kind: AccountKind; openingBalance: number; openingDate: IsoDate };

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
