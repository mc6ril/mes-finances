import { budgetLines, categoryActuals, monthTotals, plaisirBudgetOf } from '@/core/budget';
import type { MonthBudget } from '@/core/model';
import { aCategory, aTransaction, plaisirCategories } from './fixtures';

const march: MonthBudget = {
  month: '2026-03',
  planned: { restaurants: 8000, shopping: 5000, loyer: 60000 },
  carryOver: false,
};

describe('categoryActuals', () => {
  it('additionne les dépenses réalisées par catégorie en montants positifs', () => {
    const txs = [
      aTransaction({ date: '2026-03-02', amount: -4500, categoryId: 'restaurants' }),
      aTransaction({ date: '2026-03-20', amount: -5000, categoryId: 'restaurants' }),
      aTransaction({ date: '2026-04-01', amount: -9900, categoryId: 'restaurants' }),
    ];
    expect(categoryActuals(txs, plaisirCategories, '2026-03').restaurants).toEqual({
      actual: 9500,
      upcoming: 0,
    });
  });

  it('déduit une dépense remboursée de sa catégorie', () => {
    const txs = [
      aTransaction({ date: '2026-03-02', amount: -6000, categoryId: 'shopping' }),
      aTransaction({
        date: '2026-03-09',
        amount: 6000,
        categoryId: 'shopping',
        label: 'Remboursement retour colis',
      }),
    ];
    expect(categoryActuals(txs, plaisirCategories, '2026-03').shopping?.actual).toBe(0);
  });

  it('isole les opérations prévues dans « à venir »', () => {
    const txs = [aTransaction({ date: '2026-03-25', amount: -60000, categoryId: 'loyer', status: 'prevu' })];
    expect(categoryActuals(txs, plaisirCategories, '2026-03').loyer).toEqual({ actual: 0, upcoming: 60000 });
  });

  it('ne compte jamais un virement interne comme une dépense ou un revenu', () => {
    const txs = [
      aTransaction({
        date: '2026-03-02',
        amount: -10000,
        type: 'virement',
        categoryId: 'restaurants',
        counterpartAccountId: 'livret',
      }),
      aTransaction({ date: '2026-03-03', amount: 10000, type: 'virement', categoryId: 'salaire' }),
    ];
    const actuals = categoryActuals(txs, plaisirCategories, '2026-03');
    expect(actuals.restaurants?.actual ?? 0).toBe(0);
    expect(actuals.salaire?.actual ?? 0).toBe(0);
  });

  it('compte les investissements dans leur catégorie d’épargne', () => {
    const txs = [
      aTransaction({
        date: '2026-03-05',
        amount: -10000,
        type: 'investissement',
        categoryId: 'av',
        counterpartAccountId: 'av',
      }),
    ];
    expect(categoryActuals(txs, plaisirCategories, '2026-03').av?.actual).toBe(10000);
  });

  it('compte les revenus en positif', () => {
    const txs = [aTransaction({ date: '2026-03-28', amount: 250000, type: 'revenu', categoryId: 'salaire' })];
    expect(categoryActuals(txs, plaisirCategories, '2026-03').salaire?.actual).toBe(250000);
  });
});

describe('budgetLines', () => {
  it('masque une catégorie archivée sans budget ni opération, même si elle a une ligne à 0 €', () => {
    const categories = [...plaisirCategories, aCategory({ id: 'divers', group: 'plaisir', archived: true })];
    const budget: MonthBudget = { ...march, planned: { ...march.planned, divers: 0 } };
    const lines = budgetLines({ budget, previousBudget: null, categories, transactions: [] });
    expect(lines.find((line) => line.categoryId === 'divers')).toBeUndefined();
  });

  it('garde une catégorie archivée qui a encore un budget ou des opérations ce mois-ci', () => {
    const categories = [...plaisirCategories, aCategory({ id: 'divers', group: 'plaisir', archived: true })];
    const withBudget: MonthBudget = { ...march, planned: { ...march.planned, divers: 1000 } };
    const withOperation = [aTransaction({ date: '2026-03-05', amount: -500, categoryId: 'divers' })];
    expect(
      budgetLines({ budget: withBudget, previousBudget: null, categories, transactions: [] }).some(
        (line) => line.categoryId === 'divers',
      ),
    ).toBe(true);
    expect(
      budgetLines({ budget: march, previousBudget: null, categories, transactions: withOperation }).some(
        (line) => line.categoryId === 'divers',
      ),
    ).toBe(true);
  });

  it('calcule prévu, réel et écart (positif = marge restante)', () => {
    const txs = [aTransaction({ date: '2026-03-02', amount: -9500, categoryId: 'restaurants' })];
    const lines = budgetLines({
      budget: march,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: txs,
    });
    const restaurants = lines.find((line) => line.categoryId === 'restaurants');
    expect(restaurants).toMatchObject({ planned: 8000, actual: 9500, gap: -1500, status: 'depasse' });
    expect(lines.find((line) => line.categoryId === 'shopping')).toMatchObject({
      planned: 5000,
      actual: 0,
      gap: 5000,
      status: 'ok',
    });
  });

  it('pour un revenu, un écart positif signifie un revenu supérieur au prévu', () => {
    const budget: MonthBudget = { month: '2026-03', planned: { salaire: 250000 }, carryOver: false };
    const txs = [aTransaction({ date: '2026-03-28', amount: 260000, type: 'revenu', categoryId: 'salaire' })];
    const lines = budgetLines({
      budget,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'salaire')).toMatchObject({ gap: 10000, status: 'ok' });
  });

  it('signale une catégorie consommée à plus de 80 % en vigilance', () => {
    const txs = [aTransaction({ date: '2026-03-02', amount: -4200, categoryId: 'shopping' })];
    const lines = budgetLines({
      budget: march,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'shopping')?.status).toBe('attention');
  });

  it('considère une catégorie consommée exactement à 100 % comme respectée', () => {
    const txs = [aTransaction({ date: '2026-03-02', amount: -5000, categoryId: 'shopping' })];
    const lines = budgetLines({
      budget: march,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'shopping')?.status).toBe('ok');
  });

  it('reporte le reliquat plaisir du mois précédent quand le report est activé', () => {
    const april: MonthBudget = { month: '2026-04', planned: { restaurants: 8000 }, carryOver: true };
    const txs = [aTransaction({ date: '2026-03-02', amount: -3000, categoryId: 'restaurants' })];
    const lines = budgetLines({
      budget: april,
      previousBudget: march,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'restaurants')).toMatchObject({
      planned: 8000,
      carriedOver: 5000,
      available: 13000,
    });
  });

  it('ne reporte pas un dépassement du mois précédent', () => {
    const april: MonthBudget = { month: '2026-04', planned: { restaurants: 8000 }, carryOver: true };
    const txs = [aTransaction({ date: '2026-03-02', amount: -12000, categoryId: 'restaurants' })];
    const lines = budgetLines({
      budget: april,
      previousBudget: march,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'restaurants')?.carriedOver).toBe(0);
  });

  it('expose le réel du mois précédent pour comparaison', () => {
    const april: MonthBudget = { month: '2026-04', planned: { restaurants: 8000 }, carryOver: false };
    const txs = [aTransaction({ date: '2026-03-02', amount: -3000, categoryId: 'restaurants' })];
    const lines = budgetLines({
      budget: april,
      previousBudget: march,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'restaurants')?.previousActual).toBe(3000);
  });

  it('affiche une catégorie dépensée même sans budget prévu', () => {
    const budget: MonthBudget = { month: '2026-03', planned: {}, carryOver: false };
    const txs = [aTransaction({ date: '2026-03-02', amount: -3000, categoryId: 'shopping' })];
    const lines = budgetLines({
      budget,
      previousBudget: null,
      categories: plaisirCategories,
      transactions: txs,
    });
    expect(lines.find((line) => line.categoryId === 'shopping')).toMatchObject({
      planned: 0,
      actual: 3000,
      status: 'depasse',
    });
  });
});

describe('monthTotals', () => {
  it('ventile par groupe et ignore les virements internes', () => {
    const txs = [
      aTransaction({ date: '2026-03-01', amount: 250000, type: 'revenu', categoryId: 'salaire' }),
      aTransaction({ date: '2026-03-02', amount: -60000, categoryId: 'loyer' }),
      aTransaction({ date: '2026-03-03', amount: -4000, categoryId: 'restaurants' }),
      aTransaction({
        date: '2026-03-04',
        amount: -10000,
        type: 'investissement',
        categoryId: 'av',
        counterpartAccountId: 'av',
      }),
      aTransaction({
        date: '2026-03-05',
        amount: -50000,
        type: 'virement',
        categoryId: null,
        counterpartAccountId: 'livret',
      }),
      aTransaction({ date: '2026-03-06', amount: -1500, categoryId: null }),
    ];
    expect(monthTotals(txs, plaisirCategories, '2026-03')).toEqual({
      revenus: 250000,
      fixes: 60000,
      plaisir: 4000,
      plaisirMensuel: 4000,
      epargne: 10000,
      nonCategorise: 1500,
      depenses: 65500,
    });
  });
});

describe('plaisirBudgetOf', () => {
  it('somme les lignes plaisir prévues', () => {
    expect(plaisirBudgetOf(march, plaisirCategories, 26000)).toBe(13000);
  });

  it('retombe sur le budget plaisir des paramètres sans budget du mois', () => {
    expect(plaisirBudgetOf(null, plaisirCategories, 26000)).toBe(26000);
  });
});
