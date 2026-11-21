import { type BudgetLine, groupTotal, type MonthBudgetSummary } from '../budget/budget';
import type { Cents } from '../shared/model';
import type { CommonMonthSummary } from './household';

/** Enveloppe saisie : un montant égal à la proposition revient à « proposé » (null). */
export const envelopeOverride = (cents: Cents, suggested: Cents): Cents | null =>
  cents === suggested ? null : cents;

/** Part des revenus du couple apportée par un membre ; null tant que personne n'a de revenu. */
export const incomeShare = (summary: CommonMonthSummary, memberId: string): number | null =>
  summary.totalIncome > 0 ? (summary.incomes[memberId] ?? 0) / summary.totalIncome : null;

/**
 * Bandeau du mois du commun, au format du perso : les chiffres du récapitulatif face au prévu.
 * Revenus = enveloppe + autres entrées + retraits d'épargne (la part de chacun, pas les salaires
 * entiers) ; le report
 * du mois précédent ne joue que sur le solde.
 */
export const commonBudgetSummary = (
  summary: CommonMonthSummary,
  lines: BudgetLine[],
  provision: Cents,
): MonthBudgetSummary => {
  const plannedSpending =
    provision + groupTotal(lines, 'fixe', 'available') + groupTotal(lines, 'plaisir', 'available');
  return {
    income: summary.envelope + summary.inflows + summary.withdrawals,
    plannedIncome: summary.envelope,
    spending: summary.expenses,
    plannedSpending,
    saving: summary.totalSaved,
    plannedSaving: summary.savingsTotal,
    balance: summary.balance,
    plannedBalance: summary.envelope + summary.carriedOver - summary.savingsTotal - plannedSpending,
  };
};
