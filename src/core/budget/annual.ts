import { isCounted } from '../comptes/balances';
import { categoryActuals, inMonth, monthTotals, type MonthTotals } from './budget';
import { monthKeyOf, monthsOfYear } from '../shared/dates';
import { isMirrored } from '../comptes/mirror';
import type {
  Category,
  CategoryGroup,
  Cents,
  IsoDate,
  MonthKey,
  SavingsMovement,
  Transaction,
} from '../shared/model';

export type MonthSummary = { month: MonthKey; totals: MonthTotals; hasData: boolean };

export type PivotRow = {
  categoryId: string;
  name: string;
  group: CategoryGroup;
  months: Cents[];
  total: Cents;
};

export type YearSummary = {
  year: number;
  months: MonthSummary[];
  totals: {
    revenus: Cents;
    depenses: Cents;
    fixes: Cents;
    plaisir: Cents;
    plaisirMensuel: Cents;
    epargne: Cents;
  };
  monthsWithData: number;
  averageMonthlySpending: Cents;
  topCategories: { categoryId: string; name: string; group: CategoryGroup; total: Cents }[];
  pivot: PivotRow[];
  plaisirBudgetRespected: { respected: number; measured: number };
};

type YearSummaryInput = {
  transactions: Transaction[];
  categories: Category[];
  year: number;
  plaisirBudgetByMonth: (month: MonthKey) => Cents;
  today?: IsoDate;
  movements?: SavingsMovement[];
};

const GROUP_ORDER: CategoryGroup[] = ['revenu', 'fixe', 'epargne', 'plaisir'];

const hasCountedTransactions = (transactions: Transaction[], month: MonthKey): boolean =>
  inMonth(transactions, month).some(isCounted);

const buildPivot = (transactions: Transaction[], categories: Category[], months: MonthKey[]): PivotRow[] => {
  const perMonth = months.map((month) => categoryActuals(transactions, categories, month));
  return [...categories]
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    .map((category) => {
      const values = perMonth.map((actuals) => actuals[category.id]?.actual ?? 0);
      return {
        categoryId: category.id,
        name: category.name,
        group: category.group,
        months: values,
        total: values.reduce((total, value) => total + value, 0),
      };
    })
    .filter((row) => row.months.some((value) => value !== 0));
};

export const depositsInMonth = (
  movements: SavingsMovement[],
  transactions: Transaction[],
  month: MonthKey,
): Cents =>
  movements
    .filter((movement) => movement.kind === 'versement' && monthKeyOf(movement.date) === month)
    .filter((movement) => !isMirrored(movement, transactions))
    .reduce((total, movement) => total + movement.amount, 0);

export const yearSummary = ({
  transactions,
  categories,
  year,
  plaisirBudgetByMonth,
  today,
  movements = [],
}: YearSummaryInput): YearSummary => {
  const monthKeys = monthsOfYear(year);
  const months = monthKeys.map((month) => {
    const totals = monthTotals(transactions, categories, month);
    return {
      month,
      totals: { ...totals, epargne: totals.epargne + depositsInMonth(movements, transactions, month) },
      hasData: hasCountedTransactions(transactions, month),
    };
  });
  const filled = months.filter((entry) => entry.hasData);
  const totals = months.reduce(
    (sum, entry) => ({
      revenus: sum.revenus + entry.totals.revenus,
      depenses: sum.depenses + entry.totals.depenses,
      fixes: sum.fixes + entry.totals.fixes,
      plaisir: sum.plaisir + entry.totals.plaisir,
      plaisirMensuel: sum.plaisirMensuel + entry.totals.plaisirMensuel,
      epargne: sum.epargne + entry.totals.epargne,
    }),
    { revenus: 0, depenses: 0, fixes: 0, plaisir: 0, plaisirMensuel: 0, epargne: 0 },
  );
  const comparable = completedMonths(filled, today);
  const pivot = buildPivot(transactions, categories, monthKeys);
  const respected = filled.filter(
    (entry) => entry.totals.plaisirMensuel <= plaisirBudgetByMonth(entry.month),
  ).length;
  return {
    year,
    months,
    totals,
    monthsWithData: filled.length,
    averageMonthlySpending: averageOf(sumSpending(comparable), comparable.length),
    topCategories: pivot
      .filter((row) => row.group === 'fixe' || row.group === 'plaisir')
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(({ categoryId, name, group, total }) => ({ categoryId, name, group, total })),
    pivot,
    plaisirBudgetRespected: { respected, measured: filled.length },
  };
};

const completedMonths = (filled: MonthSummary[], today: IsoDate | undefined): MonthSummary[] => {
  if (!today) {
    return filled;
  }
  const completed = filled.filter((entry) => entry.month < monthKeyOf(today));
  if (completed.length === 0) {
    return filled;
  }
  return completed;
};

const sumSpending = (months: MonthSummary[]): Cents =>
  months.reduce((total, entry) => total + entry.totals.depenses, 0);

const averageOf = (total: Cents, count: number): Cents => {
  if (count === 0) {
    return 0;
  }
  return Math.round(total / count);
};
