import {
  annualLines,
  budgetLines,
  monthTotals,
  plaisirBudgetOf,
  plaisirSpent,
  provisionPerMonth,
} from '@/core/budget/budget';
import { yearSummary } from '@/core/budget/annual';
import type { MonthBudget, YearBudget } from '@/core/shared/model';
import { aTransaction, plaisirCategories } from '../fixtures';

const november: MonthBudget = {
  month: '2026-11',
  planned: { restaurants: 8000, shopping: 5000, voyages: 2000 },
  carryOver: false,
};
const year2026: YearBudget = { year: '2026', planned: { voyages: 60000 } };
const trip = (date: string, cents: number) => aTransaction({ date, amount: -cents, categoryId: 'voyages' });

describe('catégories à budget annuel', () => {
  it('sortent des lignes du budget mensuel', () => {
    const lines = budgetLines({
      budget: november,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: [],
    });
    expect(lines.map((line) => line.categoryId)).not.toContain('voyages');
  });

  it('ne comptent pas dans le budget plaisir du mois', () => {
    expect(plaisirBudgetOf(november, plaisirCategories, 26000)).toBe(13000);
  });

  it('ne comptent pas dans le plaisir dépensé du mois', () => {
    const transactions = [
      trip('2026-11-10', 45000),
      aTransaction({ date: '2026-11-11', amount: -3000, categoryId: 'restaurants' }),
    ];
    expect(plaisirSpent(transactions, plaisirCategories, '2026-11')).toBe(3000);
  });

  it('restent comptées dans les dépenses réelles du mois', () => {
    const totals = monthTotals([trip('2026-11-10', 45000)], plaisirCategories, '2026-11');
    expect(totals).toMatchObject({ plaisir: 45000, plaisirMensuel: 0, depenses: 45000 });
  });
});

describe('annualLines', () => {
  const transactions = [trip('2026-03-10', 30000), trip('2026-07-02', 25000), trip('2025-12-20', 99900)];

  it('compare la dépense de l’année au budget annuel', () => {
    const [line] = annualLines({
      yearBudget: year2026,
      categories: plaisirCategories,
      transactions,
      year: 2026,
    });
    expect(line).toMatchObject({
      categoryId: 'voyages',
      planned: 60000,
      actual: 55000,
      remaining: 5000,
      status: 'attention',
      monthlyProvision: 5000,
    });
  });

  it('signale un budget annuel dépassé', () => {
    const [line] = annualLines({
      yearBudget: { year: '2026', planned: { voyages: 50000 } },
      categories: plaisirCategories,
      transactions,
      year: 2026,
    });
    expect(line).toMatchObject({ remaining: -5000, status: 'depasse' });
  });

  it('affiche une catégorie annuelle même sans budget saisi', () => {
    const [line] = annualLines({
      yearBudget: null,
      categories: plaisirCategories,
      transactions: [],
      year: 2026,
    });
    expect(line).toMatchObject({ categoryId: 'voyages', planned: 0, actual: 0, status: 'ok' });
  });

  it('calcule la provision mensuelle totale des budgets annuels', () => {
    expect(provisionPerMonth(year2026, plaisirCategories)).toBe(5000);
    expect(provisionPerMonth(null, plaisirCategories)).toBe(0);
  });
});

describe('bilan annuel', () => {
  it('mesure le respect du budget plaisir mensuel sans les dépenses annuelles', () => {
    const summary = yearSummary({
      transactions: [
        trip('2026-03-10', 50000),
        aTransaction({ date: '2026-03-11', amount: -3000, categoryId: 'restaurants' }),
      ],
      categories: plaisirCategories,
      year: 2026,
      plaisirBudgetByMonth: () => 10000,
    });
    expect(summary.plaisirBudgetRespected).toEqual({ respected: 1, measured: 1 });
  });
});
