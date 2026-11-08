import type { Category } from './model';
import { DEFAULT_CATEGORIES } from './seed';

const DEFAULT_POSITION = new Map(DEFAULT_CATEGORIES.map((category, index) => [category.id, index]));

const positionOf = (category: Category): number =>
  DEFAULT_POSITION.get(category.id) ?? Number.MAX_SAFE_INTEGER;

export const orderCategories = (categories: Category[]): Category[] =>
  [...categories].sort(
    (a, b) => positionOf(a) - positionOf(b) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
