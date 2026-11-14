import type { ImportRule, Transaction } from '../shared/model';
import { normalizeLabel } from './csvImport';
import { findImportRule } from './importRules';

/** Opération venue d'un relevé importé (champ posé à l'import ; avant lui, le commentaire « Import … »). */
export const isImported = (transaction: Transaction): boolean =>
  transaction.imported === true ||
  (transaction.paymentMethod === '' && transaction.comment.startsWith('Import '));

export type RuleSuggestion = Omit<ImportRule, 'id'>;

/**
 * Après un changement de catégorie d'une opération importée, règle à proposer : « toujours classer
 * <mots du libellé> en <catégorie> ». Rien si une règle couvre déjà ce libellé, si la catégorie est
 * retirée ou si le libellé n'a pas de mot exploitable.
 */
export const ruleSuggestion = (
  before: Transaction,
  after: Transaction,
  rules: ImportRule[],
): RuleSuggestion | null => {
  if (!isImported(before) || after.categoryId === null || after.categoryId === before.categoryId) {
    return null;
  }
  if (after.type !== 'depense' && after.type !== 'revenu') {
    return null;
  }
  const match = normalizeLabel(after.label);
  if (!match || findImportRule(after.label, rules)) {
    return null;
  }
  return {
    match,
    type: after.type,
    categoryId: after.categoryId,
    memberId: null,
    ...(after.type === 'depense' && after.amount > 0 ? { refund: true } : {}),
  };
};

/** Première règle à proposer parmi plusieurs changements (modification groupée). */
export const firstRuleSuggestion = (
  changes: { before: Transaction; after: Transaction }[],
  rules: ImportRule[],
): RuleSuggestion | null => {
  for (const { before, after } of changes) {
    const suggestion = ruleSuggestion(before, after, rules);
    if (suggestion) {
      return suggestion;
    }
  }
  return null;
};
