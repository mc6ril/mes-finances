import { overBudgetOpacity } from '@/hooks/bilan/budgetChart';

describe('overBudgetOpacity', () => {
  it('fonce la barre d’un mois au-delà du budget', () => {
    expect(overBudgetOpacity(12000, 10000)).toBe(1);
  });

  it('atténue les mois dans le budget ou sans budget', () => {
    expect(overBudgetOpacity(10000, 10000)).toBe(0.75);
    expect(overBudgetOpacity(12000, null)).toBe(0.75);
  });
});
