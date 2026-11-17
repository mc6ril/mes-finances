import type { Imputation, Transaction } from '../shared/model';

const IMPUTATION_HINTS: Record<Imputation['kind'], (name: string, outside: boolean) => string> = {
  charge: (name, outside) =>
    outside ? `à la charge de ${name}, réglé hors compte` : `à la charge de ${name}`,
  avance: (name) => `avancé par ${name}`,
  revenu: (name, outside) => (outside ? `revenu de ${name}, versé sur son compte` : `revenu de ${name}`),
};

/**
 * Indication sous le libellé d'une opération imputée à un membre du commun.
 * Un montant positif (remboursement, somme reçue) se lit dans l'autre sens.
 */
export const imputationHint = (transaction: Transaction, memberName: string): string | null => {
  const { imputation } = transaction;
  if (!imputation) {
    return null;
  }
  if (transaction.amount > 0 && imputation.kind === 'charge') {
    return transaction.type === 'depense' ? `remboursement pour ${memberName}` : `reçu pour ${memberName}`;
  }
  if (transaction.amount > 0 && imputation.kind === 'avance') {
    return `reçu par ${memberName} sur son compte`;
  }
  return IMPUTATION_HINTS[imputation.kind](memberName, imputation.outside === true);
};

/** Indication sous le libellé d'un virement : l'autre compte, vu depuis le compte affiché. */
export const transferHint = (
  transaction: Transaction,
  accountId: string,
  accountNames: Map<string, string>,
): string | null => {
  if (!transaction.counterpartAccountId) {
    return null;
  }
  if (transaction.counterpartAccountId === accountId) {
    return `depuis ${accountNames.get(transaction.accountId) ?? ''}`;
  }
  return `vers ${accountNames.get(transaction.counterpartAccountId) ?? ''}`;
};
