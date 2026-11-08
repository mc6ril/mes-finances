import type { BudgetPeriod, Category, Dataset, MonthBudget, YearBudget } from './model';
import { SCHEMA_VERSION } from './model';
import { ANNUAL_CATEGORY_IDS, GROCERIES_CATEGORY, HEALTH_CATEGORY, TAXES_CATEGORY } from './seed';

type LegacyCategory = Omit<Category, 'period'> & { period?: BudgetPeriod };

type LegacyDataset = Omit<Dataset, 'categories' | 'yearBudgets'> & {
  categories: LegacyCategory[];
  yearBudgets?: YearBudget[];
};

const withPeriod = (category: LegacyCategory): Category => {
  if (category.period) {
    return { ...category, period: category.period };
  }
  if (ANNUAL_CATEGORY_IDS.includes(category.id)) {
    return { ...category, period: 'annuel' };
  }
  return { ...category, period: 'mensuel' };
};

const latestPlannedByYear = (budgets: MonthBudget[], annualIds: Set<string>): YearBudget[] => {
  const byYear = new Map<string, Record<string, number>>();
  [...budgets]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((budget) => {
      const year = budget.month.slice(0, 4);
      const planned = byYear.get(year) ?? {};
      Object.entries(budget.planned)
        .filter(([categoryId]) => annualIds.has(categoryId))
        .forEach(([categoryId, value]) => {
          planned[categoryId] = value * 12;
        });
      byYear.set(year, planned);
    });
  return [...byYear.entries()]
    .map(([year, planned]) => ({
      year,
      planned: Object.fromEntries(Object.entries(planned).filter(([, value]) => value > 0)),
    }))
    .filter((entry) => Object.keys(entry.planned).length > 0);
};

const withoutAnnual = (budget: MonthBudget, annualIds: Set<string>): MonthBudget => ({
  ...budget,
  planned: Object.fromEntries(
    Object.entries(budget.planned).filter(([categoryId]) => !annualIds.has(categoryId)),
  ),
});

const existingOrDerived = (dataset: LegacyDataset, annualIds: Set<string>): YearBudget[] => {
  if (dataset.yearBudgets && dataset.yearBudgets.length > 0) {
    return dataset.yearBudgets;
  }
  return latestPlannedByYear(dataset.budgets, annualIds);
};

const toVersion2 = (dataset: LegacyDataset): Dataset => {
  const categories = dataset.categories.map(withPeriod);
  const annualIds = new Set(
    categories.filter((category) => category.period === 'annuel').map((category) => category.id),
  );
  return {
    ...dataset,
    schemaVersion: 2,
    categories,
    yearBudgets: existingOrDerived(dataset, annualIds),
    budgets: dataset.budgets.map((budget) => withoutAnnual(budget, annualIds)),
  };
};

const withCategory = (categories: Category[], added: Category): Category[] => {
  if (categories.some((category) => category.id === added.id)) {
    return categories;
  }
  return [...categories, added];
};

const toVersion3 = (dataset: Dataset): Dataset => ({
  ...dataset,
  categories: withCategory(dataset.categories, TAXES_CATEGORY),
});

const toVersion4 = (dataset: Dataset): Dataset => ({
  ...dataset,
  categories: withCategory(withCategory(dataset.categories, GROCERIES_CATEGORY), HEALTH_CATEGORY),
});

const STEPS: { version: number; apply: (dataset: Dataset) => Dataset }[] = [
  { version: 3, apply: toVersion3 },
  { version: 4, apply: toVersion4 },
];

const upToVersion2 = (dataset: LegacyDataset): Dataset => {
  if (dataset.schemaVersion >= 2) {
    return dataset as Dataset;
  }
  return toVersion2(dataset);
};

export const migrateDataset = (dataset: LegacyDataset): Dataset => {
  if (dataset.schemaVersion >= SCHEMA_VERSION) {
    return dataset as Dataset;
  }
  return STEPS.filter((step) => step.version > dataset.schemaVersion).reduce(
    (current, step) => ({ ...step.apply(current), schemaVersion: step.version }),
    upToVersion2(dataset),
  );
};
