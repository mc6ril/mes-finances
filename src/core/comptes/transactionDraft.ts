import { savingsCategoryFor } from '../budget/budget';
import { parseFlexibleDate } from '../shared/dates';
import type { AppErrorCode } from '../shared/errors';
import type {
  Account,
  Category,
  CategoryGroup,
  HouseholdMember,
  Imputation,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../shared/model';
import { parseEuros } from '../shared/money';
import { isInternalMoveType } from './balances';

/** Saisie d'une opération telle que le formulaire la tient (textes bruts). */
export type TransactionForm = {
  date: string;
  label: string;
  amount: string;
  type: TransactionType;
  isRefund: boolean;
  categoryId: string;
  accountId: string;
  counterpartAccountId: string;
  paymentMethod: string;
  status: TransactionStatus;
  /** Passée et vérifiée sur le relevé bancaire. */
  verified: boolean;
  comment: string;
  /** Espace commun : '' (commun), 'charge:<membre>', 'avance:<membre>' ou 'revenu:<membre>'. */
  imputation: string;
};

/** Opération prête à enregistrer, sans identifiant ni horodatage. */
export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

/** Choix du type dans le formulaire : un remboursement est une dépense positive. */
export type TypeChoice = TransactionType | 'remboursement';

export const GROUPS_BY_TYPE: Record<TransactionType, CategoryGroup[]> = {
  revenu: ['revenu'],
  depense: ['fixe', 'plaisir'],
  virement: ['epargne'],
  investissement: ['epargne'],
};

const acceptsCategory = (type: TransactionType, category: Category): boolean =>
  GROUPS_BY_TYPE[type].includes(category.group);

/** Catégories suivies qu'un type d'opération peut recevoir. */
export const categoriesForType = (categories: Category[], type: TransactionType): Category[] =>
  categories.filter((category) => !category.archived && acceptsCategory(type, category));

/**
 * Catégories proposées pour une opération : celles du type, plus sa catégorie actuelle si elle n'y
 * figure pas (archivée depuis) — sans quoi le formulaire afficherait « Sans catégorie » à tort.
 */
export const categoryChoices = (
  categories: Category[],
  type: TransactionType,
  currentId: string,
): Category[] => {
  const choices = categoriesForType(categories, type);
  const current = categories.find((category) => category.id === currentId);
  if (!current || choices.includes(current)) {
    return choices;
  }
  return [...choices, current];
};

export const typeChoiceOf = (form: Pick<TransactionForm, 'type' | 'isRefund'>): TypeChoice =>
  form.type === 'depense' && form.isRefund ? 'remboursement' : form.type;

/**
 * Comptes débité et crédité d'un virement tels que le formulaire les montre. Venu de l'extérieur
 * (montant positif, sans compte crédité), il est enregistré sur le compte qui le reçoit : débité vide.
 */
export const moveSidesOf = (
  transaction: Pick<Transaction, 'type' | 'accountId' | 'counterpartAccountId' | 'amount'>,
): Pick<TransactionForm, 'accountId' | 'counterpartAccountId'> =>
  isInternalMoveType(transaction.type) && transaction.counterpartAccountId === null && transaction.amount > 0
    ? { accountId: '', counterpartAccountId: transaction.accountId }
    : { accountId: transaction.accountId, counterpartAccountId: transaction.counterpartAccountId ?? '' };

/** Changement de type : passer d'une dépense à son remboursement garde la catégorie, sinon elle est vidée. */
export const changeType = <Form extends TransactionForm>(form: Form, choice: TypeChoice): Form => {
  const refund = choice === 'remboursement';
  const staysExpense = form.type === 'depense' && (refund || choice === 'depense');
  // Hors virement, le compte débité vide n'existe pas : on garde le compte qui recevait l'argent.
  const incomingLeft = form.accountId === '' && !isInternalMoveType(refund ? 'depense' : choice);
  return {
    ...form,
    ...(incomingLeft ? { accountId: form.counterpartAccountId, counterpartAccountId: '' } : {}),
    type: refund ? 'depense' : choice,
    isRefund: refund,
    categoryId: staysExpense ? form.categoryId : '',
    imputation: '',
  };
};

/** Catégorie d'épargne d'un virement ou d'un investissement : celle du compte crédité. */
export const moveCategoryId = (
  counterpartAccountId: string | null,
  accounts: Account[],
  categories: Category[],
): string | null =>
  savingsCategoryFor(
    counterpartAccountId || null,
    (id) => accounts.find((account) => account.id === id)?.name,
    categories,
  );

/**
 * Espace commun : dépense « pour qui » (à la charge de / avancée par) ou revenu « de qui ».
 * Le revenu d'un membre dont le salaire n'arrive pas sur le commun reste hors du compte.
 */
export const imputationOf = (
  form: Pick<TransactionForm, 'type' | 'imputation'>,
  members: HouseholdMember[],
): Imputation | undefined => {
  const [kind, memberId] = form.imputation.split(':');
  if (!memberId) {
    return undefined;
  }
  if (form.type === 'depense' && (kind === 'charge' || kind === 'avance')) {
    return { kind, memberId };
  }
  if (form.type === 'revenu' && kind === 'charge') {
    return { kind, memberId };
  }
  if (form.type === 'revenu' && kind === 'revenu') {
    const member = members.find((candidate) => candidate.id === memberId);
    return { kind, memberId, ...(member?.salaryOnCommon === false ? { outside: true } : {}) };
  }
  return undefined;
};

/** Signe du montant : un revenu et un remboursement entrent, le reste sort. */
export const signFor = (form: Pick<TransactionForm, 'type' | 'isRefund'>): 1 | -1 => {
  if (form.type === 'revenu') {
    return 1;
  }
  if (form.type === 'depense' && form.isRefund) {
    return 1;
  }
  return -1;
};

export type TransactionFormField = 'date' | 'label' | 'amount' | 'counterpartAccountId';

export type TransactionFormErrors = Partial<Record<TransactionFormField, AppErrorCode>>;

export type DraftResult =
  | { ok: true; value: TransactionDraft }
  | { ok: false; errors: TransactionFormErrors };

export type DraftContext = { members: HouseholdMember[]; accounts: Account[]; categories: Category[] };

/** Valide la saisie (toutes les erreurs à la fois, une par champ) et construit l'opération à enregistrer. */
export const draftFromForm = (form: TransactionForm, context: DraftContext): DraftResult => {
  const errors: TransactionFormErrors = {};
  const date = parseFlexibleDate(form.date);
  const amount = parseEuros(form.amount);
  const internalMove = isInternalMoveType(form.type);
  if (!date) {
    errors.date = 'transaction-date-invalid';
  }
  if (form.label.trim() === '') {
    errors.label = 'transaction-label-empty';
  }
  if (amount === null || amount === 0) {
    errors.amount = 'transaction-amount-invalid';
  }
  // Un côté vide = hors de l'appli (autre banque, une personne) ; les deux vides ou égaux : refusé.
  if (internalMove && form.counterpartAccountId === form.accountId) {
    errors.counterpartAccountId = 'transaction-counterpart-invalid';
  }
  if (!date || amount === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const categoryId = internalMove
    ? moveCategoryId(form.counterpartAccountId, context.accounts, context.categories)
    : form.categoryId || null;
  const imputation = imputationOf(form, context.members);
  // Venu de l'extérieur : enregistré en entrée sur le compte qui le reçoit.
  const incoming = internalMove && form.accountId === '';
  return {
    ok: true,
    value: {
      date,
      label: form.label.trim(),
      amount: Math.abs(amount) * (incoming ? 1 : signFor(form)),
      type: form.type,
      categoryId,
      accountId: incoming ? form.counterpartAccountId : form.accountId,
      counterpartAccountId: internalMove && !incoming ? form.counterpartAccountId || null : null,
      paymentMethod: form.paymentMethod,
      status: form.status,
      ...(form.status === 'realise' && form.verified ? { verified: true } : {}),
      comment: form.comment.trim(),
      ...(imputation ? { imputation } : {}),
    },
  };
};

/** Catégories applicables à toute une sélection : celles qu'accepte chacun de ses types. */
export const categoriesForSelection = (categories: Category[], transactions: Transaction[]): Category[] => {
  const types = new Set(transactions.map((transaction) => transaction.type));
  if (types.size === 0) {
    return [];
  }
  return categories.filter(
    (category) => !category.archived && [...types].every((type) => acceptsCategory(type, category)),
  );
};

export type CategoryChange = { before: Transaction; after: Transaction };

/** Changement de catégorie groupé : les opérations dont le type n'accepte pas la catégorie restent intactes. */
export const recategorize = (
  transactions: Transaction[],
  categoryId: string,
  categories: Category[],
): CategoryChange[] => {
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) {
    return [];
  }
  return transactions
    .filter((transaction) => acceptsCategory(transaction.type, category))
    .map((before) => ({ before, after: { ...before, categoryId } }));
};

/** Opérations vérifiées sur le relevé : elles sont forcément passées. */
export const markVerified = (transactions: Transaction[]): Transaction[] =>
  transactions.map((transaction) => ({ ...transaction, status: 'realise', verified: true }));
