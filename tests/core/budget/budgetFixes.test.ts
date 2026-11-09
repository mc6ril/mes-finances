import { annualActualInMonth, budgetLines, propagateBudgetLine } from '@/core/budget/budget';
import { orderCategories } from '@/core/budget/categoryOrder';
import type { MonthBudget } from '@/core/shared/model';
import { patrimoineSeries } from '@/core/patrimoine/patrimoine';
import { aCategory, anAccount, aTransaction } from '../fixtures';

const budgetOf = (month: string, restaurants: number): MonthBudget => ({
  month,
  planned: { restaurants, shopping: 5000 },
  carryOver: false,
});

describe('propagateBudgetLine', () => {
  it('crée le budget du mois à partir du budget hérité', () => {
    const result = propagateBudgetLine([budgetOf('2026-10', 10000)], '2026-11', 'restaurants', 12000);
    expect(result).toEqual([
      { month: '2026-11', planned: { restaurants: 12000, shopping: 5000 }, carryOver: false },
    ]);
  });

  it('reporte la modification sur les mois suivants qui avaient le même montant', () => {
    const result = propagateBudgetLine(
      [budgetOf('2026-10', 10000), budgetOf('2026-11', 10000), budgetOf('2026-12', 10000)],
      '2026-10',
      'restaurants',
      8000,
    );
    expect(result.map((budget) => [budget.month, budget.planned.restaurants])).toEqual([
      ['2026-10', 8000],
      ['2026-11', 8000],
      ['2026-12', 8000],
    ]);
  });

  it('s’arrête au premier mois où le montant avait été ajusté', () => {
    const result = propagateBudgetLine(
      [budgetOf('2026-10', 10000), budgetOf('2026-11', 15000), budgetOf('2026-12', 10000)],
      '2026-10',
      'restaurants',
      8000,
    );
    expect(result.map((budget) => budget.month)).toEqual(['2026-10']);
  });

  it('ne touche pas aux autres lignes des mois suivants', () => {
    const later = { ...budgetOf('2026-11', 10000), planned: { restaurants: 10000, shopping: 7000 } };
    const result = propagateBudgetLine([budgetOf('2026-10', 10000), later], '2026-10', 'restaurants', 8000);
    expect(result[1]?.planned).toEqual({ restaurants: 8000, shopping: 7000 });
  });
});

describe('annualActualInMonth', () => {
  it('additionne les dépenses réalisées du mois sur les catégories annuelles', () => {
    const categories = [aCategory(), aCategory({ id: 'voyages', name: 'Voyages', period: 'annuel' })];
    const transactions = [
      aTransaction({ categoryId: 'voyages', amount: -30000, date: '2026-11-04' }),
      aTransaction({ categoryId: 'voyages', amount: -5000, date: '2026-11-20', status: 'prevu' }),
      aTransaction({ categoryId: 'voyages', amount: -9000, date: '2026-10-20' }),
      aTransaction({ categoryId: 'restaurants', amount: -2000, date: '2026-11-05' }),
    ];
    expect(annualActualInMonth(transactions, categories, '2026-11')).toBe(30000);
  });
});

describe('statut des charges fixes', () => {
  it('ne signale pas une charge fixe proche de son budget', () => {
    const categories = [aCategory({ id: 'loyer', name: 'Logement', group: 'fixe' })];
    const [line] = budgetLines({
      budget: { month: '2026-11', planned: { loyer: 10000 }, carryOver: false },
      previousBudget: null,
      categories,
      transactions: [aTransaction({ categoryId: 'loyer', amount: -9000, date: '2026-11-02' })],
    });
    expect(line?.status).toBe('ok');
  });

  it('signale toujours une charge fixe dépassée', () => {
    const categories = [aCategory({ id: 'loyer', name: 'Logement', group: 'fixe' })];
    const [line] = budgetLines({
      budget: { month: '2026-11', planned: { loyer: 10000 }, carryOver: false },
      previousBudget: null,
      categories,
      transactions: [aTransaction({ categoryId: 'loyer', amount: -11000, date: '2026-11-02' })],
    });
    expect(line?.status).toBe('depasse');
  });
});

describe('orderCategories', () => {
  it('suit l’ordre des catégories par défaut puis les catégories créées par ordre alphabétique', () => {
    const ordered = orderCategories([
      aCategory({ id: 'perso-z', name: 'Zoo' }),
      aCategory({ id: 'cat-divers', name: 'Divers' }),
      aCategory({ id: 'perso-a', name: 'Animaux' }),
      aCategory({ id: 'cat-restaurants', name: 'Restaurants et sorties' }),
    ]);
    expect(ordered.map((category) => category.id)).toEqual([
      'cat-restaurants',
      'cat-divers',
      'perso-a',
      'perso-z',
    ]);
  });
});

describe('patrimoineSeries avec la date du jour', () => {
  it('évalue le mois en cours à aujourd’hui plutôt qu’à la fin du mois', () => {
    const courant = anAccount({ openingBalance: 50000, openingDate: '2026-10-01' });
    const transactions = [aTransaction({ amount: -20000, date: '2026-11-30', categoryId: null })];
    const series = patrimoineSeries(
      [courant],
      { transactions, movements: [], valuations: [] },
      ['2026-10', '2026-11'],
      '2026-11-06',
    );
    expect(series.map((point) => [point.date, point.personalTotal])).toEqual([
      ['2026-10-31', 50000],
      ['2026-11-06', 50000],
    ]);
  });
});

describe('orderCategories dans un espace commun', () => {
  it('suit l’ordre de départ du compte commun', async () => {
    const { COMMON_CATEGORIES } = await import('@/core/shared/seed');
    const shuffled = [...COMMON_CATEGORIES].reverse();
    expect(orderCategories(shuffled, 'commun').map((category) => category.id)).toEqual(
      COMMON_CATEGORIES.map((category) => category.id),
    );
  });
});
