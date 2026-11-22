import { type BudgetLine, groupTotal } from '../budget/budget';
import type { Cents } from '../shared/model';
import type { CommonMonthSummary } from './household';

/** Enveloppe saisie : un montant égal à la proposition revient à « proposé » (null). */
export const envelopeOverride = (cents: Cents, suggested: Cents): Cents | null =>
  cents === suggested ? null : cents;

/** Part des revenus du couple apportée par un membre ; null tant que personne n'a de revenu. */
export const incomeShare = (summary: CommonMonthSummary, memberId: string): number | null =>
  summary.totalIncome > 0 ? (summary.incomes[memberId] ?? 0) / summary.totalIncome : null;

/** Répartition du budget du commun : ce qu'il y a à répartir, ce qui est prévu, ce qu'il reste à prévoir. */
export type CommonBudgetPlan = { toAllocate: Cents; planned: Cents; remaining: Cents };

/**
 * À répartir = enveloppe + report + autres entrées − épargne prévue ; les retraits d'épargne en sont
 * exclus, ils financent des dépenses précises. Prévu = budgets des dépenses fixes et communes +
 * provision des budgets annuels.
 */
export const commonBudgetPlan = (
  summary: CommonMonthSummary,
  lines: BudgetLine[],
  provision: Cents,
): CommonBudgetPlan => {
  const toAllocate = summary.envelope + summary.carriedOver + summary.inflows - summary.savingsTotal;
  const planned =
    provision + groupTotal(lines, 'fixe', 'available') + groupTotal(lines, 'plaisir', 'available');
  return { toAllocate, planned, remaining: toAllocate - planned };
};
