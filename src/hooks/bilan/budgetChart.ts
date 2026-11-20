import type { Cents } from '@/core/shared/model';

/** Barre pleine pour un mois au-delà du budget, atténuée sinon. */
export const overBudgetOpacity = (spent: Cents, budget: Cents | null): number => {
  if (budget !== null && spent > budget) {
    return 1;
  }
  return 0.75;
};
