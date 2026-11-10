import { savingsCategoryFor } from '@/core/budget/budget';
import { DEFAULT_CATEGORIES } from '@/core/shared/seed';

const names: Record<string, string> = { ldds: 'LDDS', tr: 'Trade Republic', pea: 'PEA', av: 'Assurance vie' };
const nameOf = (id: string) => names[id];

describe('savingsCategoryFor', () => {
  it('prend la catégorie d’épargne qui porte le nom du compte crédité', () => {
    expect(savingsCategoryFor('ldds', nameOf, DEFAULT_CATEGORIES)).toBe('cat-ep-ldds');
    expect(savingsCategoryFor('tr', nameOf, DEFAULT_CATEGORIES)).toBe('cat-ep-trade-republic');
    expect(savingsCategoryFor('av', nameOf, DEFAULT_CATEGORIES)).toBe('cat-ep-assurance-vie');
  });

  it('ne devine rien sans catégorie du même nom ni compte crédité', () => {
    expect(savingsCategoryFor('pea', nameOf, DEFAULT_CATEGORIES)).toBeNull();
    expect(savingsCategoryFor(null, nameOf, DEFAULT_CATEGORIES)).toBeNull();
  });
});
