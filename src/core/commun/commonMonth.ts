import type { Cents } from '../shared/model';
import type { CommonMonthSummary } from './household';

/** Enveloppe saisie : un montant égal à la proposition revient à « proposé » (null). */
export const envelopeOverride = (cents: Cents, suggested: Cents): Cents | null =>
  cents === suggested ? null : cents;

/** Part des revenus du couple apportée par un membre ; null tant que personne n'a de revenu. */
export const incomeShare = (summary: CommonMonthSummary, memberId: string): number | null =>
  summary.totalIncome > 0 ? (summary.incomes[memberId] ?? 0) / summary.totalIncome : null;
