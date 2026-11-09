import { parseEuros } from '@/core/shared/money';
import { parseFlexibleDate } from '@/core/shared/dates';
import type {
  Category,
  Imputation,
  CategoryGroup,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/core/shared/model';
import type { TransactionDraft } from '@/core/usecases/transactions';

export type TransactionFormState = {
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
  comment: string;
  /** Espace commun : '' (commun), 'charge:<membre>' ou 'avance:<membre>'. */
  imputation: string;
};

export const GROUPS_BY_TYPE: Record<TransactionType, CategoryGroup[]> = {
  revenu: ['revenu'],
  depense: ['fixe', 'plaisir'],
  virement: ['epargne'],
  investissement: ['epargne'],
};

export const categoriesForType = (categories: Category[], type: TransactionType): Category[] =>
  categories.filter((category) => !category.archived && GROUPS_BY_TYPE[type].includes(category.group));

export const needsCounterpart = (type: TransactionType): boolean =>
  type === 'virement' || type === 'investissement';

const amountText = (cents: number): string => (Math.abs(cents) / 100).toFixed(2).replace('.', ',');

export const formFromTransaction = (transaction: Transaction): TransactionFormState => ({
  date: transaction.date,
  label: transaction.label,
  amount: amountText(transaction.amount),
  type: transaction.type,
  isRefund: transaction.type === 'depense' && transaction.amount > 0,
  categoryId: transaction.categoryId ?? '',
  accountId: transaction.accountId,
  counterpartAccountId: transaction.counterpartAccountId ?? '',
  paymentMethod: transaction.paymentMethod,
  status: transaction.status,
  comment: transaction.comment,
  imputation: transaction.imputation
    ? `${transaction.imputation.kind}:${transaction.imputation.memberId}`
    : '',
});

export const initialForm = (
  source: Transaction | null,
  date: string,
  accountId: string,
): TransactionFormState => {
  if (source) {
    return formFromTransaction(source);
  }
  return emptyForm(date, accountId);
};

export const emptyForm = (date: string, accountId: string): TransactionFormState => ({
  date,
  label: '',
  amount: '',
  type: 'depense',
  isRefund: false,
  categoryId: '',
  accountId,
  counterpartAccountId: '',
  paymentMethod: 'Carte',
  status: 'realise',
  comment: '',
  imputation: '',
});

/** La répartition « pour qui » ne concerne que les dépenses. */
const imputationOf = (form: TransactionFormState): { imputation?: Imputation } => {
  const [kind, memberId] = form.imputation.split(':');
  if (form.type !== 'depense' || (kind !== 'charge' && kind !== 'avance') || !memberId) {
    return {};
  }
  return { imputation: { kind, memberId } };
};

const signFor = (form: TransactionFormState): 1 | -1 => {
  if (form.type === 'revenu') {
    return 1;
  }
  if (form.type === 'depense' && form.isRefund) {
    return 1;
  }
  return -1;
};

export type FormErrors = Partial<Record<'date' | 'label' | 'amount' | 'counterpartAccountId', string>>;

export const validateForm = (
  form: TransactionFormState,
): { draft: TransactionDraft | null; errors: FormErrors } => {
  const errors: FormErrors = {};
  const date = parseFlexibleDate(form.date);
  const amount = parseEuros(form.amount);
  if (!date) {
    errors.date = 'Date invalide';
  }
  if (form.label.trim() === '') {
    errors.label = 'Le libellé est obligatoire';
  }
  if (amount === null || amount === 0) {
    errors.amount = 'Montant invalide (ex. 45,90)';
  }
  if (
    needsCounterpart(form.type) &&
    (form.counterpartAccountId === '' || form.counterpartAccountId === form.accountId)
  ) {
    errors.counterpartAccountId = 'Choisis un compte de destination différent';
  }
  if (!date || amount === null || Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }
  return {
    errors,
    draft: {
      date,
      label: form.label.trim(),
      amount: Math.abs(amount) * signFor(form),
      type: form.type,
      categoryId: form.categoryId || null,
      accountId: form.accountId,
      counterpartAccountId: needsCounterpart(form.type) ? form.counterpartAccountId : null,
      paymentMethod: form.paymentMethod,
      status: form.status,
      comment: form.comment.trim(),
      recurringId: null,
      ...imputationOf(form),
    },
  };
};
