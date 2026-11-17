import { categoriesOfGroup, hasBudgetPeriod, newCategoryDraft } from '@/core/budget/categories';
import { aCategory } from '../fixtures';

describe('catégories d’un groupe', () => {
  const categories = [
    aCategory({ id: 'resto', group: 'plaisir' }),
    aCategory({ id: 'loyer', group: 'fixe' }),
    aCategory({ id: 'vieux', group: 'plaisir', archived: true }),
    aCategory({ id: 'cine', group: 'plaisir' }),
  ];

  it('sépare les actives des archivées, dans l’ordre d’origine', () => {
    const { active, archived } = categoriesOfGroup(categories, 'plaisir');
    expect(active.map((category) => category.id)).toEqual(['resto', 'cine']);
    expect(archived.map((category) => category.id)).toEqual(['vieux']);
  });

  it('renvoie deux listes vides pour un groupe sans catégorie', () => {
    expect(categoriesOfGroup(categories, 'revenu')).toEqual({ active: [], archived: [] });
  });
});

describe('période de budget', () => {
  it('ne se règle que pour les charges fixes et les dépenses personnelles', () => {
    expect(hasBudgetPeriod(aCategory({ group: 'fixe' }))).toBe(true);
    expect(hasBudgetPeriod(aCategory({ group: 'plaisir' }))).toBe(true);
    expect(hasBudgetPeriod(aCategory({ group: 'revenu' }))).toBe(false);
    expect(hasBudgetPeriod(aCategory({ group: 'epargne' }))).toBe(false);
  });
});

describe('nouvelle catégorie', () => {
  it('crée une catégorie mensuelle active au nom nettoyé', () => {
    expect(newCategoryDraft('  Sport ', 'plaisir')).toEqual({
      name: 'Sport',
      group: 'plaisir',
      period: 'mensuel',
      archived: false,
    });
  });

  it('refuse un nom vide', () => {
    expect(newCategoryDraft('   ', 'fixe')).toBeNull();
  });
});
