import { isCounted } from '../comptes/balances';
import { categoryActuals, inMonth, monthTotals, type MonthTotals } from './budget';
import { monthKeyOf, monthsOfYear } from '../shared/dates';
import { isMirrored } from '../comptes/mirror';
import type {
  Account,
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
  /** Pour reconnaître les virements sans catégorie vers un compte d'épargne ou un placement. */
  accounts?: Account[];
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

const savingsAccountIds = (accounts: Account[]): Set<string> =>
  new Set(accounts.filter((account) => account.group !== 'courant').map((account) => account.id));

/**
 * Virements sans catégorie d'épargne d'un compte courant vers un compte d'épargne ou un placement
 * (ceux catégorisés sont déjà comptés par leur catégorie), regroupés par compte de destination.
 */
const uncategorizedSavings = (
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  month: MonthKey,
): Map<string, Cents> => {
  const targets = savingsAccountIds(accounts);
  const savingsCategories = new Set(
    categories.filter((category) => category.group === 'epargne').map((category) => category.id),
  );
  const result = new Map<string, Cents>();
  inMonth(transactions, month)
    .filter(
      (transaction) =>
        isCounted(transaction) &&
        (transaction.type === 'virement' || transaction.type === 'investissement') &&
        transaction.counterpartAccountId !== null &&
        targets.has(transaction.counterpartAccountId) &&
        !targets.has(transaction.accountId) &&
        !savingsCategories.has(transaction.categoryId ?? ''),
    )
    .forEach((transaction) => {
      const target = transaction.counterpartAccountId!;
      result.set(target, (result.get(target) ?? 0) - transaction.amount);
    });
  return result;
};

const sumOf = (values: Map<string, Cents>): Cents =>
  [...values.values()].reduce((total, value) => total + value, 0);

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
  accounts = [],
}: YearSummaryInput): YearSummary => {
  const monthKeys = monthsOfYear(year);
  const transfers = monthKeys.map((month) => uncategorizedSavings(transactions, categories, accounts, month));
  const months = monthKeys.map((month, index) => {
    const totals = monthTotals(transactions, categories, month);
    const saved = depositsInMonth(movements, transactions, month) + sumOf(transfers[index]!);
    return {
      month,
      totals: { ...totals, epargne: totals.epargne + saved },
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
  const pivot = [
    ...buildPivot(transactions, categories, monthKeys),
    ...transferRows(accounts, transfers),
  ].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
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

/** Une ligne « Épargne » par compte de destination des virements non catégorisés. */
const transferRows = (accounts: Account[], transfers: Map<string, Cents>[]): PivotRow[] =>
  accounts
    .filter((account) => transfers.some((month) => month.has(account.id)))
    .map((account) => {
      const values = transfers.map((month) => month.get(account.id) ?? 0);
      return {
        categoryId: `account:${account.id}`,
        name: account.name,
        group: 'epargne' as const,
        months: values,
        total: values.reduce((total, value) => total + value, 0),
      };
    });

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
