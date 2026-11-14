import { budgetPrefill, isBudgetEmpty } from '@/core/budget/prefill';
import { overBudgetLines, type BudgetLine } from '@/core/budget/budget';
import type { Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aCategory, aTransaction } from '../fixtures';

const withTransactions = (transactions: Dataset['transactions']): Dataset => ({
  ...createInitialDataset('2026-01-01', () => 'audit'),
  categories: [
    aCategory({ id: 'courses', name: 'Courses', group: 'fixe' }),
    aCategory({ id: 'resto', name: 'Restaurants' }),
    aCategory({ id: 'voyages', name: 'Voyages', period: 'annuel' }),
    aCategory({ id: 'salaire', name: 'Salaire', group: 'revenu' }),
    aCategory({ id: 'vieux', name: 'Ancien', archived: true }),
  ],
  transactions,
});

describe('budget pré-rempli', () => {
  it('propose la moyenne des 3 derniers mois, arrondie à l’euro', () => {
    const dataset = withTransactions([
      aTransaction({ date: '2026-08-05', categoryId: 'courses', amount: -30000 }),
      aTransaction({ date: '2026-09-05', categoryId: 'courses', amount: -31050 }),
      aTransaction({ date: '2026-10-05', categoryId: 'courses', amount: -32000 }),
      aTransaction({ date: '2026-10-07', categoryId: 'resto', amount: -9000 }),
      // Remboursement : réduit la catégorie.
      aTransaction({ date: '2026-10-08', categoryId: 'resto', amount: 1500 }),
      // Hors période, annuelle, revenu, archivée ou prévue : ignorées.
      aTransaction({ date: '2026-07-05', categoryId: 'courses', amount: -99900 }),
      aTransaction({ date: '2026-10-09', categoryId: 'voyages', amount: -50000 }),
      aTransaction({ date: '2026-10-01', categoryId: 'salaire', amount: 250000, type: 'revenu' }),
      aTransaction({ date: '2026-10-02', categoryId: 'vieux', amount: -5000 }),
      aTransaction({ date: '2026-10-20', categoryId: 'resto', amount: -6000, status: 'prevu' }),
    ]);
    // Courses : (300 + 310,50 + 320) / 3 = 310,17 → 310 € ; Restaurants : 75 / 3 = 25 €.
    expect(budgetPrefill(dataset, '2026-11')).toEqual({ courses: 31000, resto: 2500 });
  });

  it('ne compte que les mois déjà saisis', () => {
    const dataset = withTransactions([
      aTransaction({ date: '2026-10-05', categoryId: 'courses', amount: -30049 }),
    ]);
    expect(budgetPrefill(dataset, '2026-11')).toEqual({ courses: 30000 });
  });

  it('ne propose rien sans un mois d’historique', () => {
    expect(budgetPrefill(withTransactions([]), '2026-11')).toBeNull();
    const current = withTransactions([aTransaction({ date: '2026-11-03', categoryId: 'courses' })]);
    expect(budgetPrefill(current, '2026-11')).toBeNull();
  });

  it('considère vide un budget absent ou à zéro', () => {
    expect(isBudgetEmpty(null)).toBe(true);
    expect(isBudgetEmpty({ month: '2026-11', planned: { courses: 0 }, carryOver: false })).toBe(true);
    expect(isBudgetEmpty({ month: '2026-11', planned: { courses: 100 }, carryOver: false })).toBe(false);
  });
});

const line = (patch: Partial<BudgetLine>): BudgetLine => ({
  categoryId: 'c',
  name: 'C',
  group: 'plaisir',
  planned: 10000,
  carriedOver: 0,
  available: 10000,
  actual: 12000,
  upcoming: 0,
  gap: -2000,
  progress: 1.2,
  previousActual: 0,
  status: 'depasse',
  ...patch,
});

describe('catégories dépassées', () => {
  it('ne compte que les dépenses au-delà d’un budget prévu', () => {
    const lines = [
      line({ categoryId: 'a' }),
      line({ categoryId: 'b', group: 'fixe' }),
      line({ categoryId: 'c', status: 'attention' }),
      line({ categoryId: 'd', available: 0, planned: 0 }),
      line({ categoryId: 'e', group: 'epargne' }),
      line({ categoryId: 'f', group: 'revenu', status: 'attention' }),
    ];
    expect(overBudgetLines(lines).map((item) => item.categoryId)).toEqual(['a', 'b']);
  });
});
