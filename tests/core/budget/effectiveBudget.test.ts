import { effectiveBudget, effectiveYearBudget } from '@/core/budget/budget';
import type { MonthBudget, YearBudget } from '@/core/shared/model';

const november: MonthBudget = { month: '2026-11', planned: { restaurants: 12000 }, carryOver: true };
const february: MonthBudget = { month: '2027-02', planned: { restaurants: 9000 }, carryOver: false };

describe('effectiveBudget', () => {
  it('utilise le budget du mois quand il a été défini', () => {
    expect(effectiveBudget([november, february], '2026-11')).toEqual({
      budget: november,
      inheritedFrom: null,
    });
  });

  it('reprend le dernier budget défini pour les mois suivants', () => {
    expect(effectiveBudget([november, february], '2027-01')).toEqual({
      budget: { month: '2027-01', planned: { restaurants: 12000 }, carryOver: true },
      inheritedFrom: '2026-11',
    });
  });

  it('suit le changement le plus récent', () => {
    expect(effectiveBudget([february, november], '2027-06').inheritedFrom).toBe('2027-02');
  });

  it('ne remonte pas dans le passé avant le premier budget', () => {
    expect(effectiveBudget([november], '2026-10')).toEqual({
      budget: { month: '2026-10', planned: {}, carryOver: false },
      inheritedFrom: null,
    });
  });

  it('ne partage pas l’objet du budget d’origine', () => {
    const { budget } = effectiveBudget([november], '2026-12');
    budget.planned.restaurants = 1;
    expect(november.planned.restaurants).toBe(12000);
  });
});

describe('effectiveYearBudget', () => {
  const year2026: YearBudget = { year: '2026', planned: { voyages: 50000 } };

  it('reprend le budget annuel de l’année précédente', () => {
    expect(effectiveYearBudget([year2026], '2027')).toEqual({
      budget: { year: '2027', planned: { voyages: 50000 } },
      inheritedFrom: '2026',
    });
  });

  it('utilise le budget de l’année quand il existe', () => {
    expect(effectiveYearBudget([year2026], '2026')).toEqual({ budget: year2026, inheritedFrom: null });
  });

  it('renvoie un budget vide sans historique', () => {
    expect(effectiveYearBudget([year2026], '2025')).toEqual({ budget: null, inheritedFrom: null });
  });
});
