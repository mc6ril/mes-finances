import type { Category, CategoryGroup } from '../shared/model';

/** Catégories d'un groupe, actives puis archivées, chacune dans l'ordre d'origine. */
export const categoriesOfGroup = (
  categories: Category[],
  group: CategoryGroup,
): { active: Category[]; archived: Category[] } => {
  const ofGroup = categories.filter((category) => category.group === group);
  return {
    active: ofGroup.filter((category) => !category.archived),
    archived: ofGroup.filter((category) => category.archived),
  };
};

const PERIOD_GROUPS: CategoryGroup[] = ['fixe', 'plaisir'];

/** Seules les charges fixes et les dépenses personnelles se budgètent au mois ou à l'année. */
export const hasBudgetPeriod = (category: Pick<Category, 'group'>): boolean =>
  PERIOD_GROUPS.includes(category.group);

/** Nouvelle catégorie, mensuelle et active ; null si le nom est vide. */
export const newCategoryDraft = (name: string, group: CategoryGroup): Omit<Category, 'id'> | null => {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  return { name: trimmed, group, period: 'mensuel', archived: false };
};
