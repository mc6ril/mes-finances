import { goalStartFor } from '../patrimoine/goalTracking';
import type {
  BudgetPeriod,
  Category,
  Dataset,
  Goal,
  MonthBudget,
  Settings,
  Transaction,
  YearBudget,
} from '../shared/model';
import { SCHEMA_VERSION } from '../shared/model';
import { ANNUAL_CATEGORY_IDS, GROCERIES_CATEGORY, HEALTH_CATEGORY, TAXES_CATEGORY } from '../shared/seed';

type LegacyCategory = Omit<Category, 'period'> & { period?: BudgetPeriod };

type LegacySettings = Omit<Settings, 'kind' | 'household'> & Partial<Pick<Settings, 'kind' | 'household'>>;

type LegacyDataset = Omit<
  Dataset,
  'categories' | 'yearBudgets' | 'monthNotes' | 'commonMonths' | 'settlements' | 'settings'
> & {
  settings: LegacySettings;
  categories: LegacyCategory[];
  yearBudgets?: YearBudget[];
  monthNotes?: Dataset['monthNotes'];
  commonMonths?: Dataset['commonMonths'];
  settlements?: Dataset['settlements'];
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
    monthNotes: dataset.monthNotes ?? [],
    ...v7Fields(dataset),
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

type LegacyGoal = Omit<Goal, 'startDate' | 'startAmount'> & Partial<Pick<Goal, 'startDate' | 'startAmount'>>;

const toVersion5 = (dataset: Dataset): Dataset => {
  const sources = {
    accounts: dataset.accounts,
    context: {
      transactions: dataset.transactions,
      movements: dataset.savingsMovements,
      valuations: dataset.valuations,
    },
    audit: dataset.audit,
  };
  return {
    ...dataset,
    goals: (dataset.goals as LegacyGoal[]).map((goal) =>
      goal.startDate !== undefined && goal.startAmount !== undefined
        ? (goal as Goal)
        : { ...goal, ...goalStartFor(goal, sources) },
    ),
  };
};

/** Champs ajoutés en v7 ; posés dès la v2 pour garder un Dataset complet à chaque étape. */
const v7Fields = (dataset: LegacyDataset) => ({
  settings: {
    ...dataset.settings,
    kind: dataset.settings.kind ?? 'perso',
    household: dataset.settings.household ?? null,
  },
  commonMonths: dataset.commonMonths ?? [],
  settlements: dataset.settlements ?? [],
});

const toVersion7 = (dataset: Dataset): Dataset => ({ ...dataset, ...v7Fields(dataset) });

type LegacyLine = { id: string; label: string; amount: number; memberId?: string };
type LegacyCommonMonth = Dataset['commonMonths'][number] & { incomes?: LegacyLine[]; inflows?: LegacyLine[] };

/** v8 : les revenus et entrées du mois du commun deviennent des opérations de revenu. */
const toVersion8 = (dataset: Dataset): Dataset => {
  const members = dataset.settings.household?.members ?? [];
  const created: Transaction[] = [];
  const commonMonths = (dataset.commonMonths as LegacyCommonMonth[]).map(
    ({ incomes = [], inflows = [], ...entry }) => {
      const date = `${entry.month}-01`;
      const operation = (line: LegacyLine, index: number, partial: Partial<Transaction>): Transaction => ({
        id: `mig8-${entry.month}-${index}`,
        date,
        label: line.label,
        amount: line.amount,
        accountId: dataset.settings.mainAccountId,
        counterpartAccountId: null,
        categoryId: null,
        type: 'revenu',
        status: 'realise',
        paymentMethod: '',
        comment: '',
        recurringId: null,
        createdAt: `${date}T00:00:00.000Z`,
        updatedAt: `${date}T00:00:00.000Z`,
        ...partial,
      });
      incomes.forEach((line, index) => {
        const member = members.find((candidate) => candidate.id === line.memberId);
        created.push(
          operation(line, index, {
            categoryId: 'cat-salaire',
            imputation: {
              kind: 'revenu',
              memberId: line.memberId ?? '',
              ...(member?.salaryOnCommon === false ? { outside: true } : {}),
            },
          }),
        );
      });
      inflows.forEach((line, index) =>
        created.push(operation(line, incomes.length + index, { categoryId: 'cat-autres-entrees' })),
      );
      return entry;
    },
  );
  return { ...dataset, commonMonths, transactions: [...dataset.transactions, ...created] };
};

/** v9 : règles d'import des relevés. */
const toVersion9 = (dataset: Dataset): Dataset => ({
  ...dataset,
  settings: { ...dataset.settings, importRules: dataset.settings.importRules ?? [] },
});

/**
 * v10 : le salaire d'un membre versé hors du commun n'est plus une opération du compte
 * mais un montant du mois du commun (outsideIncomes).
 */
const toVersion10 = (dataset: Dataset): Dataset => {
  const isOutsideSalary = (transaction: Transaction) =>
    transaction.type === 'revenu' &&
    transaction.imputation?.kind === 'revenu' &&
    transaction.imputation.outside === true;
  const moved = dataset.transactions.filter(isOutsideSalary);
  if (moved.length === 0) {
    return dataset;
  }
  const byMonth = new Map<string, Record<string, number>>();
  for (const transaction of moved) {
    const month = transaction.date.slice(0, 7);
    const incomes = byMonth.get(month) ?? {};
    const memberId = transaction.imputation!.memberId;
    incomes[memberId] = (incomes[memberId] ?? 0) + transaction.amount;
    byMonth.set(month, incomes);
  }
  const existing = new Set(dataset.commonMonths.map((entry) => entry.month));
  const commonMonths = [
    ...dataset.commonMonths.map((entry) => {
      const incomes = byMonth.get(entry.month);
      return incomes ? { ...entry, outsideIncomes: { ...entry.outsideIncomes, ...incomes } } : entry;
    }),
    ...[...byMonth]
      .filter(([month]) => !existing.has(month))
      .map(([month, incomes]) => ({ month, envelope: null, savingsRates: null, outsideIncomes: incomes })),
  ];
  // Un mois sans revenu hors commun ne doit pas hériter de celui du mois précédent.
  const members = [...new Set(moved.map((transaction) => transaction.imputation!.memberId))];
  const months = [...byMonth.keys()].sort();
  const filled = commonMonths.map((entry) =>
    entry.month >= months[0]! && entry.month <= months[months.length - 1]!
      ? {
          ...entry,
          outsideIncomes: Object.fromEntries(
            members.map((memberId) => [memberId, entry.outsideIncomes?.[memberId] ?? 0]),
          ),
        }
      : entry,
  );
  const removed = new Set(moved.map((transaction) => transaction.id));
  return {
    ...dataset,
    commonMonths: filled,
    transactions: dataset.transactions.filter((transaction) => !removed.has(transaction.id)),
  };
};

/** v11 : suppression du mode simplifié et de son enveloppe personnelle ; tout est suivi en mode complet. */
const toVersion11 = (dataset: Dataset): Dataset => {
  const {
    mode: _mode,
    personalEnvelope: _envelope,
    ...settings
  } = dataset.settings as Settings & {
    mode?: unknown;
    personalEnvelope?: unknown;
  };
  return { ...dataset, settings };
};

/**
 * v12 : deux statuts d'opération (prévu, passé) ; l'ancien statut « rapproché » devient une
 * opération passée cochée « vérifiée sur mon relevé ».
 */
const toVersion12 = (dataset: Dataset): Dataset => ({
  ...dataset,
  transactions: dataset.transactions.map((transaction) =>
    (transaction.status as string) === 'rapproche'
      ? { ...transaction, status: 'realise', verified: true }
      : transaction,
  ),
});

const toVersion6 = (dataset: Dataset): Dataset => ({ ...dataset, monthNotes: dataset.monthNotes ?? [] });

const STEPS: { version: number; apply: (dataset: Dataset) => Dataset }[] = [
  { version: 3, apply: toVersion3 },
  { version: 4, apply: toVersion4 },
  { version: 5, apply: toVersion5 },
  { version: 6, apply: toVersion6 },
  { version: 7, apply: toVersion7 },
  { version: 8, apply: toVersion8 },
  { version: 9, apply: toVersion9 },
  { version: 10, apply: toVersion10 },
  { version: 11, apply: toVersion11 },
  { version: 12, apply: toVersion12 },
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
