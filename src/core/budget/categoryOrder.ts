import type { Category, WorkspaceKind } from '../shared/model';
import { COMMON_CATEGORIES, DEFAULT_CATEGORIES } from '../shared/seed';

const positions = (categories: Category[]) =>
  new Map(categories.map((category, index) => [category.id, index]));

const REFERENCE: Record<WorkspaceKind, Map<string, number>> = {
  perso: positions(DEFAULT_CATEGORIES),
  commun: positions(COMMON_CATEGORIES),
};

/** Catégories dans l'ordre de départ du type d'espace, puis les catégories ajoutées par ordre alphabétique. */
export const orderCategories = (categories: Category[], kind: WorkspaceKind = 'perso'): Category[] => {
  const reference = REFERENCE[kind];
  const positionOf = (category: Category): number => reference.get(category.id) ?? Number.MAX_SAFE_INTEGER;
  return [...categories].sort(
    (a, b) => positionOf(a) - positionOf(b) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
};
