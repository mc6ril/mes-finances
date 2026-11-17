import {
  categoryShare,
  type MonthSummary,
  monthlyChartData,
  type PivotRow,
  pivotByGroup,
  visibleMonthIndex,
} from '@/core/budget/annual';
import type { MonthTotals } from '@/core/budget/budget';

const totals = (overrides: Partial<MonthTotals> = {}): MonthTotals => ({
  revenus: 0,
  fixes: 0,
  plaisir: 0,
  plaisirMensuel: 0,
  epargne: 0,
  nonCategorise: 0,
  depenses: 0,
  ...overrides,
});

const aMonth = (month: string, hasData: boolean, overrides: Partial<MonthTotals> = {}): MonthSummary => ({
  month,
  hasData,
  totals: totals(overrides),
});

const aRow = (overrides: Partial<PivotRow>): PivotRow => ({
  categoryId: 'x',
  name: 'X',
  group: 'plaisir',
  months: [],
  total: 0,
  ...overrides,
});

describe('visibleMonthIndex', () => {
  it('montre décembre pour une année passée', () => {
    expect(visibleMonthIndex(2025, '2026-03-10')).toBe(11);
  });

  it('montre le mois en cours pour l’année courante', () => {
    expect(visibleMonthIndex(2026, '2026-03-10')).toBe(2);
    expect(visibleMonthIndex(2026, '2026-01-01')).toBe(0);
  });
});

describe('monthlyChartData', () => {
  it('reprend les totaux du mois et le budget plaisir des mois renseignés', () => {
    const months = [
      aMonth('2026-01', true, { revenus: 300, depenses: 200, epargne: 50, plaisir: 90, plaisirMensuel: 80 }),
    ];
    expect(monthlyChartData(months, () => 100)).toEqual([
      { month: '2026-01', revenus: 300, depenses: 200, epargne: 50, plaisir: 80, budget: 100 },
    ]);
  });

  it('ne trace pas de budget pour un mois sans données', () => {
    const budgetOf = vi.fn(() => 100);
    const [point] = monthlyChartData([aMonth('2026-02', false)], budgetOf);
    expect(point?.budget).toBeNull();
    expect(budgetOf).not.toHaveBeenCalled();
  });

  it('passe le mois au calcul du budget', () => {
    const budgetOf = (month: string) => (month === '2026-03' ? 500 : 0);
    expect(monthlyChartData([aMonth('2026-03', true)], budgetOf)[0]?.budget).toBe(500);
  });
});

describe('categoryShare', () => {
  it('rapporte un total à celui de la première catégorie, en pourcentage', () => {
    expect(categoryShare(5000, 20000)).toBe(25);
    expect(categoryShare(20000, 20000)).toBe(100);
  });

  it('ne divise jamais par zéro', () => {
    expect(categoryShare(0, 0)).toBe(0);
    expect(categoryShare(50, undefined)).toBe(5000);
  });
});

describe('pivotByGroup', () => {
  it('range les lignes par groupe, dans l’ordre revenu, fixe, épargne, plaisir', () => {
    const pivot = [
      aRow({ categoryId: 'resto', group: 'plaisir' }),
      aRow({ categoryId: 'loyer', group: 'fixe' }),
      aRow({ categoryId: 'salaire', group: 'revenu' }),
      aRow({ categoryId: 'av', group: 'epargne' }),
      aRow({ categoryId: 'eau', group: 'fixe' }),
    ];
    expect(pivotByGroup(pivot).map(({ group, rows }) => [group, rows.map((row) => row.categoryId)])).toEqual([
      ['revenu', ['salaire']],
      ['fixe', ['loyer', 'eau']],
      ['epargne', ['av']],
      ['plaisir', ['resto']],
    ]);
  });

  it('omet les groupes sans ligne', () => {
    expect(pivotByGroup([aRow({ group: 'fixe' })]).map((section) => section.group)).toEqual(['fixe']);
    expect(pivotByGroup([])).toEqual([]);
  });
});
