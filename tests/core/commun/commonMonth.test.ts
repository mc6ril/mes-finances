import type { BudgetLine } from '@/core/budget/budget';
import { commonBudgetSummary } from '@/core/commun/commonMonth';
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
  totalSaved: 27000,
  available: 270000 - 8600 + 16659 - 27000,
  expenses: 251676,
  balance: 270000 - 8600 + 16659 - 27000 - 251676,
};

const line = (group: BudgetLine['group'], available: number): BudgetLine =>
  ({ categoryId: group, name: group, group, available, actual: 0 }) as BudgetLine;

describe('bandeau du mois du commun', () => {
  it('compare au prévu les chiffres du récapitulatif', () => {
    const lines = [line('fixe', 200000), line('plaisir', 30000), line('epargne', 99999)];
    expect(commonBudgetSummary(summary, lines, 10000)).toEqual({
      income: 270000 + 16659,
      plannedIncome: 270000,
      spending: 251676,
      plannedSpending: 240000,
      saving: 27000,
      plannedSaving: 27000,
      balance: summary.balance,
      plannedBalance: 270000 - 8600 - 27000 - 240000,
    });
  });

  it('compte dans l’épargne réelle un remboursement placé sur un livret, pas dans le prévu', () => {
    const withRefund = { ...summary, savedRefunds: 10500, totalSaved: 37500 };
    expect(commonBudgetSummary(withRefund, [], 0)).toMatchObject({ saving: 37500, plannedSaving: 27000 });
  });
});
