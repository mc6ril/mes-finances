import { COLLECTION_NAMES, itemKey } from '@/core/shared/collections';
import { createInitialDataset } from '@/core/shared/seed';

describe('collections', () => {
  it('couvre toutes les collections d’un jeu de données', () => {
    const dataset = createInitialDataset('2026-11-01', () => 'x');
    const fromDataset = Object.keys(dataset).filter((key) =>
      Array.isArray(dataset[key as keyof typeof dataset]),
    );
    expect([...COLLECTION_NAMES].sort()).toEqual(fromDataset.sort());
  });

  it('identifie un élément par son id, son mois ou son année', () => {
    expect(itemKey('transactions', { id: 't1' })).toBe('t1');
    expect(itemKey('budgets', { month: '2026-11' })).toBe('2026-11');
    expect(itemKey('yearBudgets', { year: '2026' })).toBe('2026');
  });
});
