import {
  type BudgetLine,
  budgetLines,
  budgetUsage,
  hasSpendingLimit,
  monthBudgetSummary,
  SPENDING_ALERT_THRESHOLD,
  spendingStatus,
} from '@/core/budget/budget';
import { budgetGroupsFor } from '@/core/budget/overview';
import type { CategoryGroup } from '@/core/shared/model';
import { aCategory, aTransaction } from '../fixtures';

const aLine = (group: CategoryGroup, available: number, actual: number): BudgetLine => ({
  categoryId: `${group}-${available}-${actual}`,
  name: group,
  group,
  planned: available,
  carriedOver: 0,
  available,
  actual,
  upcoming: 0,
  gap: 0,
  progress: 0,
  previousActual: 0,
  status: 'ok',
});

describe('part du budget utilisée', () => {
  it('rapporte le réel au budget', () => {
    expect(budgetUsage(5000, 10000)).toBe(0.5);
    expect(budgetUsage(15000, 10000)).toBe(1.5);
  });

  it('compte une dépense sans budget comme un budget entièrement utilisé, pas comme 0 %', () => {
    expect(budgetUsage(1000, 0)).toBe(1);
    expect(budgetUsage(0, 0)).toBe(0);
    expect(budgetUsage(-500, 0)).toBe(0);
  });
});

describe('état des dépenses face au budget', () => {
  it('alerte à 80 % du budget, le même seuil que les catégories', () => {
    expect(SPENDING_ALERT_THRESHOLD).toBe(0.8);
    expect(spendingStatus(7900, 10000)).toBe('ok');
    expect(spendingStatus(8000, 10000)).toBe('attention');
    expect(spendingStatus(9900, 10000)).toBe('attention');
  });

  it('est dans le budget quand il est tout juste atteint, dépassé au-delà', () => {
    expect(spendingStatus(10000, 10000)).toBe('ok');
    expect(spendingStatus(10001, 10000)).toBe('depasse');
  });

  it('signale une dépense sans budget comme un dépassement', () => {
    expect(spendingStatus(1000, 0)).toBe('depasse');
    expect(spendingStatus(0, 0)).toBe('ok');
  });
});

describe('lignes de budget sans montant prévu', () => {
  it('remplissent la barre de progression quand la catégorie a des dépenses', () => {
    const [line] = budgetLines({
      budget: { month: '2026-03', planned: {}, carryOver: false },
      previousBudget: null,
      categories: [aCategory()],
      transactions: [aTransaction({ date: '2026-03-05', amount: -2500 })],
    });
    expect(line?.status).toBe('depasse');
    expect(line?.progress).toBe(1);
  });
});

describe('résumé du mois', () => {
  const lines = [
    aLine('revenu', 300000, 280000),
    aLine('fixe', 100000, 90000),
    aLine('plaisir', 50000, 60000),
    aLine('epargne', 40000, 40000),
  ];

  it('additionne revenus, dépenses (budgets annuels compris) et épargne, en réel et en prévu', () => {
    expect(monthBudgetSummary(lines, 10000, 5000)).toEqual({
      income: 280000,
      plannedIncome: 300000,
      spending: 90000 + 60000 + 5000,
      plannedSpending: 100000 + 50000 + 10000,
      saving: 40000,
      plannedSaving: 40000,
      balance: 280000 - 155000 - 40000,
      plannedBalance: 300000 - 160000 - 40000,
    });
  });

  it('vaut zéro sans aucune ligne', () => {
    expect(monthBudgetSummary([], 0, 0)).toEqual({
      income: 0,
      plannedIncome: 0,
      spending: 0,
      plannedSpending: 0,
      saving: 0,
      plannedSaving: 0,
      balance: 0,
      plannedBalance: 0,
    });
  });
});

describe('groupes du budget', () => {
  it('affiche les quatre groupes dans un espace perso', () => {
    expect(budgetGroupsFor('perso')).toEqual(['revenu', 'fixe', 'epargne', 'plaisir']);
  });

  it('retire revenus et épargne dans le commun, calculés dans le mois du commun', () => {
    expect(budgetGroupsFor('commun')).toEqual(['fixe', 'plaisir']);
  });

  it('ne suit un dépassement que pour les dépenses', () => {
    expect(hasSpendingLimit('fixe')).toBe(true);
    expect(hasSpendingLimit('plaisir')).toBe(true);
    expect(hasSpendingLimit('revenu')).toBe(false);
    expect(hasSpendingLimit('epargne')).toBe(false);
  });
});
