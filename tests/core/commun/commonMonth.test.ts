import type { BudgetLine } from '@/core/budget/budget';
import { commonBudgetPlan } from '@/core/commun/commonMonth';
import type { CommonMonthSummary } from '@/core/commun/household';

const summary: CommonMonthSummary = {
  incomes: { m1: 300000, m2: 100000 },
  totalIncome: 400000,
  suggestedEnvelope: 300000,
  envelope: 270000,
  contributions: { m1: 202500, m2: 67500 },
  carriedOver: -8600,
  inflows: 16659,
  savings: [{ accountId: 'livret', rate: 0.1, amount: 27000 }],
  savingsTotal: 27000,
  savedRefunds: 0,
  withdrawals: 0,
  totalSaved: 27000,
  available: 270000 - 8600 + 16659 - 27000,
  expenses: 251676,
  balance: 270000 - 8600 + 16659 - 27000 - 251676,
};

const line = (group: BudgetLine['group'], available: number): BudgetLine =>
  ({ categoryId: group, name: group, group, available, actual: 0 }) as BudgetLine;

describe('répartition du budget du commun', () => {
  it('répartit enveloppe, report et autres entrées moins l’épargne prévue', () => {
    const lines = [line('fixe', 200000), line('plaisir', 30000), line('epargne', 99999)];
    expect(commonBudgetPlan(summary, lines, 10000)).toEqual({
      toAllocate: 270000 - 8600 + 16659 - 27000,
      planned: 240000,
      remaining: 270000 - 8600 + 16659 - 27000 - 240000,
    });
  });

  it('laisse hors de la répartition les retraits d’épargne et les remboursements placés', () => {
    const withMoves = { ...summary, withdrawals: 90000, savedRefunds: 10500, totalSaved: 37500 };
    expect(commonBudgetPlan(withMoves, [], 0).toAllocate).toBe(270000 - 8600 + 16659 - 27000);
  });
});
