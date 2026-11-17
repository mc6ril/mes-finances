import { centsToInput } from '@/core/shared/money';
import type { Transaction } from '@/core/shared/model';
import type { TransactionForm } from '@/core/comptes/transactionDraft';

/** État du formulaire d'une opération (textes saisis) ; les règles de saisie sont dans core/comptes/transactionDraft. */
export type TransactionFormState = TransactionForm;

export const formFromTransaction = (transaction: Transaction): TransactionFormState => ({
  date: transaction.date,
  label: transaction.label,
  amount: centsToInput(Math.abs(transaction.amount)),
  type: transaction.type,
  isRefund: transaction.type === 'depense' && transaction.amount > 0,
  categoryId: transaction.categoryId ?? '',
  accountId: transaction.accountId,
  counterpartAccountId: transaction.counterpartAccountId ?? '',
  paymentMethod: transaction.paymentMethod,
  status: transaction.status,
  verified: transaction.verified === true,
  comment: transaction.comment,
  imputation: transaction.imputation
    ? `${transaction.imputation.kind}:${transaction.imputation.memberId}`
    : '',
});

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
  verified: false,
  comment: '',
  imputation: '',
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
