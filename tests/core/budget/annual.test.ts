import { yearSummary } from '@/core/budget/annual';
import { aTransaction, plaisirCategories } from '../fixtures';

const salary = (month: string) =>
  aTransaction({ date: `${month}-28`, amount: 250000, type: 'revenu', categoryId: 'salaire' });
const rent = (month: string) => aTransaction({ date: `${month}-02`, amount: -60000, categoryId: 'loyer' });
const resto = (month: string, cents: number) =>
  aTransaction({ date: `${month}-12`, amount: -cents, categoryId: 'restaurants' });
const av = (month: string) =>
  aTransaction({
    date: `${month}-05`,
    amount: -10000,
    type: 'investissement',
    categoryId: 'av',
    counterpartAccountId: 'av',
  });

const transactions = [
  salary('2026-01'),
  rent('2026-01'),
  resto('2026-01', 8000),
  av('2026-01'),
  salary('2026-02'),
  rent('2026-02'),
  resto('2026-02', 2000),
  av('2026-02'),
  salary('2026-03'),
  rent('2026-03'),
  resto('2026-03', 15000),
  av('2026-03'),
];

describe('yearSummary', () => {
  const summary = yearSummary({
    transactions,
    categories: plaisirCategories,
    year: 2026,
    plaisirBudgetByMonth: () => 10000,
  });

  it('totalise revenus, dépenses, charges fixes, plaisir et épargne', () => {
    expect(summary.totals).toEqual({
      revenus: 750000,
      depenses: 205000,
      fixes: 180000,
      plaisir: 25000,
      plaisirMensuel: 25000,
      epargne: 30000,
    });
  });

  it('calcule la moyenne mensuelle sur les seuls mois renseignés', () => {
    expect(summary.monthsWithData).toBe(3);
    expect(summary.averageMonthlySpending).toBe(68333);
  });

  it('classe les catégories de dépenses', () => {
    expect(summary.topCategories.map((entry) => entry.categoryId)).toEqual(['loyer', 'restaurants']);
  });

  it('construit le tableau catégories × mois', () => {
    const row = summary.pivot.find((entry) => entry.categoryId === 'restaurants');
    expect(row?.months.slice(0, 4)).toEqual([8000, 2000, 15000, 0]);
    expect(row?.total).toBe(25000);
  });

  it('mesure le respect du budget plaisir mois par mois', () => {
    expect(summary.plaisirBudgetRespected).toEqual({ respected: 2, measured: 3 });
  });
});

describe('yearSummary avec un mois en cours', () => {
  const withCurrent = [...transactions, resto('2026-04', 500)];
  const summary = yearSummary({
    transactions: withCurrent,
    categories: plaisirCategories,
    year: 2026,
    plaisirBudgetByMonth: () => 10000,
    today: '2026-04-05',
  });

  it('exclut le mois en cours de la moyenne', () => {
    expect(summary.averageMonthlySpending).toBe(68333);
  });

  it('garde le mois en cours dans les totaux', () => {
    expect(summary.totals.plaisir).toBe(25500);
    expect(summary.monthsWithData).toBe(4);
  });
});
