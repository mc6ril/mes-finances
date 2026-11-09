import { isCounted } from '../comptes/balances';
import { addMonths } from '../shared/dates';
import type {
  Cents,
  CommonMonth,
  Dataset,
  HouseholdMember,
  MonthKey,
  SavingsRate,
  Transaction,
} from '../shared/model';

const ROUNDING = 5000;

/** x % des revenus du couple, arrondi aux 50 € supérieurs. */
export const suggestedEnvelope = (totalIncome: Cents, rate: number): Cents =>
  Math.ceil(Math.round(totalIncome * rate) / ROUNDING) * ROUNDING;

/** Part de chacun au prorata de ses revenus ; le dernier membre absorbe l'arrondi. */
export const contributionsFor = (
  envelope: Cents,
  incomes: Record<string, Cents>,
  members: HouseholdMember[],
): Record<string, Cents> => {
  const total = members.reduce((sum, member) => sum + (incomes[member.id] ?? 0), 0);
  const result: Record<string, Cents> = {};
  let allocated = 0;
  members.forEach((member, index) => {
    if (total === 0) {
      result[member.id] = 0;
      return;
    }
    const share =
      index === members.length - 1
        ? envelope - allocated
        : Math.round((envelope * (incomes[member.id] ?? 0)) / total);
    result[member.id] = share;
    allocated += share;
  });
  return result;
};

const emptyMonth = (month: MonthKey): CommonMonth => ({ month, envelope: null, savingsRates: null });

export const commonMonthOf = (dataset: Dataset, month: MonthKey): CommonMonth =>
  dataset.commonMonths.find((entry) => entry.month === month) ?? emptyMonth(month);

/** Taux d'épargne du mois, ou ceux du dernier mois qui en définit. */
export const effectiveSavingsRates = (commonMonths: CommonMonth[], month: MonthKey): SavingsRate[] =>
  [...commonMonths]
    .filter((entry) => entry.month <= month && entry.savingsRates !== null)
    .sort((a, b) => b.month.localeCompare(a.month))[0]?.savingsRates ?? [];

/** Revenu hors commun d'un membre : celui du mois, ou du dernier mois qui en indique un. */
export const effectiveOutsideIncome = (
  commonMonths: CommonMonth[],
  month: MonthKey,
  memberId: string,
): Cents =>
  [...commonMonths]
    .filter((entry) => entry.month <= month && entry.outsideIncomes?.[memberId] !== undefined)
    .sort((a, b) => b.month.localeCompare(a.month))[0]?.outsideIncomes?.[memberId] ?? 0;

export const membersOf = (dataset: Dataset): HouseholdMember[] => dataset.settings.household?.members ?? [];

/** Prénom du membre, ou « Personne 1 / 2 » tant qu'il n'est pas renseigné. */
export const memberLabel = (dataset: Dataset, memberId: string): string => {
  const members = membersOf(dataset);
  const index = members.findIndex((member) => member.id === memberId);
  return members[index]?.name.trim() || `Personne ${index + 1}`;
};

const inMonth = (transaction: Transaction, month: MonthKey): boolean => transaction.date.startsWith(month);

const revenuesIn = (transactions: Transaction[], month: MonthKey): Transaction[] =>
  transactions.filter(
    (transaction) => transaction.type === 'revenu' && isCounted(transaction) && inMonth(transaction, month),
  );

/**
 * Revenus de chaque membre : opérations de revenu rattachées à lui, plus, pour un membre
 * dont le salaire n'arrive pas sur le commun, le montant saisi dans le mois du commun.
 */
const incomesByMember = (dataset: Dataset, month: MonthKey, members: HouseholdMember[]) =>
  Object.fromEntries(
    members.map((member) => [
      member.id,
      revenuesIn(dataset.transactions, month)
        .filter(
          (transaction) =>
            transaction.imputation?.kind === 'revenu' && transaction.imputation.memberId === member.id,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0) +
        (member.salaryOnCommon ? 0 : effectiveOutsideIncome(dataset.commonMonths, month, member.id)),
    ]),
  ) as Record<string, Cents>;

/** Autres entrées : revenus du commun, rattachés à personne (intérêts, retrait d'épargne…). */
const otherInflows = (transactions: Transaction[], month: MonthKey): Cents =>
  revenuesIn(transactions, month)
    .filter((transaction) => !transaction.imputation)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

const commonExpenses = (transactions: Transaction[], month: MonthKey): Cents =>
  0 -
  transactions
    .filter(
      (transaction) =>
        transaction.type === 'depense' &&
        isCounted(transaction) &&
        inMonth(transaction, month) &&
        transaction.imputation?.kind !== 'charge',
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

export type CommonMonthSummary = {
  incomes: Record<string, Cents>;
  totalIncome: Cents;
  suggestedEnvelope: Cents;
  envelope: Cents;
  contributions: Record<string, Cents>;
  carriedOver: Cents;
  inflows: Cents;
  savings: (SavingsRate & { amount: Cents })[];
  savingsTotal: Cents;
  available: Cents;
  expenses: Cents;
  balance: Cents;
};

const firstTrackedMonth = (dataset: Dataset): MonthKey | null =>
  dataset.commonMonths.map((entry) => entry.month).sort()[0] ?? null;

const singleMonth = (dataset: Dataset, month: MonthKey, carriedOver: Cents): CommonMonthSummary => {
  const members = membersOf(dataset);
  const entry = commonMonthOf(dataset, month);
  const incomes = incomesByMember(dataset, month, members);
  const totalIncome = Object.values(incomes).reduce((sum, value) => sum + value, 0);
  const suggested = suggestedEnvelope(totalIncome, dataset.settings.household?.contributionRate ?? 0);
  const envelope = entry.envelope ?? suggested;
  const inflows = otherInflows(dataset.transactions, month);
  const savings = effectiveSavingsRates(dataset.commonMonths, month).map((line) => ({
    ...line,
    amount: Math.round(envelope * line.rate),
  }));
  const savingsTotal = savings.reduce((sum, line) => sum + line.amount, 0);
  const available = envelope + carriedOver + inflows - savingsTotal;
  const expenses = commonExpenses(dataset.transactions, month);
  return {
    incomes,
    totalIncome,
    suggestedEnvelope: suggested,
    envelope,
    contributions: contributionsFor(envelope, incomes, members),
    carriedOver,
    inflows,
    savings,
    savingsTotal,
    available,
    expenses,
    balance: available - expenses,
  };
};

/** Le report d'un mois sur l'autre se fait à l'euro près. */
const toWholeEuros = (cents: Cents): Cents => Math.round(cents / 100) * 100;

/** Mois du commun ; le bilan de chaque mois est reporté sur le suivant depuis le premier mois suivi. */
export const commonMonthSummary = (dataset: Dataset, month: MonthKey): CommonMonthSummary => {
  const first = firstTrackedMonth(dataset);
  if (!first || month < first) {
    return singleMonth(dataset, month, 0);
  }
  let carried = 0;
  for (let current = first; current < month; current = addMonths(current, 1)) {
    carried = toWholeEuros(singleMonth(dataset, current, carried).balance);
  }
  return singleMonth(dataset, month, carried);
};

export type SettlementLine = {
  kind: 'income' | 'contribution' | 'charge' | 'avance';
  label: string;
  /** Positif : le commun doit au membre ; négatif : le membre doit au commun. */
  amount: Cents;
  transactionId?: string;
};

export type MemberSettlement = {
  lines: SettlementLine[];
  due: Cents;
  carriedOver: Cents;
  settled: Cents;
  /** Positif : virement du commun vers le membre ; négatif : du membre vers le commun. */
  toSettle: Cents;
};

const settlementLines = (dataset: Dataset, month: MonthKey, member: HouseholdMember): SettlementLine[] => {
  const summary = commonMonthSummary(dataset, month);
  const imputed = (kind: 'charge' | 'avance') =>
    dataset.transactions.filter(
      (transaction) =>
        isCounted(transaction) &&
        inMonth(transaction, month) &&
        transaction.imputation?.kind === kind &&
        transaction.imputation.memberId === member.id,
    );
  return [
    ...(member.salaryOnCommon
      ? [
          {
            kind: 'income' as const,
            label: 'Revenus arrivés sur le commun',
            amount: summary.incomes[member.id] ?? 0,
          },
        ]
      : []),
    { kind: 'contribution', label: 'Part du commun', amount: -(summary.contributions[member.id] ?? 0) },
    ...imputed('charge').map((transaction) => ({
      kind: 'charge' as const,
      label: transaction.label,
      amount: transaction.amount,
      transactionId: transaction.id,
    })),
    ...imputed('avance').map((transaction) => ({
      kind: 'avance' as const,
      label: transaction.label,
      amount: -transaction.amount,
      transactionId: transaction.id,
    })),
  ];
};

const dueOf = (dataset: Dataset, month: MonthKey, member: HouseholdMember): Cents =>
  settlementLines(dataset, month, member).reduce((sum, line) => sum + line.amount, 0);

const settledIn = (dataset: Dataset, month: MonthKey, memberId: string): Cents =>
  dataset.settlements
    .filter((settlement) => settlement.month === month && settlement.memberId === memberId)
    .reduce((sum, settlement) => sum + settlement.amount, 0);

export const memberSettlement = (dataset: Dataset, month: MonthKey, memberId: string): MemberSettlement => {
  const member = membersOf(dataset).find((candidate) => candidate.id === memberId);
  if (!member) {
    return { lines: [], due: 0, carriedOver: 0, settled: 0, toSettle: 0 };
  }
  const lines = settlementLines(dataset, month, member);
  const due = lines.reduce((sum, line) => sum + line.amount, 0);
  const first = firstTrackedMonth(dataset);
  let carriedOver = 0;
  for (let current = first ?? month; current < month; current = addMonths(current, 1)) {
    carriedOver += dueOf(dataset, current, member) - settledIn(dataset, current, memberId);
  }
  const settled = settledIn(dataset, month, memberId);
  return { lines, due, carriedOver, settled, toSettle: due + carriedOver - settled };
};

const normalizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

/**
 * Virements du relevé pouvant régler le mois d'un membre : virements du compte commun
 * sans contrepartie, pas encore rattachés, dans le sens attendu, datés du mois ou des deux
 * suivants. Ceux dont le libellé contient le prénom du membre, puis les montants les plus
 * proches, d'abord.
 */
export const settlementCandidates = (dataset: Dataset, month: MonthKey, memberId: string): Transaction[] => {
  const { toSettle } = memberSettlement(dataset, month, memberId);
  const linked = new Set(dataset.settlements.map((settlement) => settlement.transactionId));
  const from = `${month}-01`;
  const to = `${addMonths(month, 2)}-31`;
  const name = normalizeWords(memberLabel(dataset, memberId));
  const named = (transaction: Transaction) => {
    const words = new Set(normalizeWords(transaction.label));
    return name.length > 0 && name.every((word) => words.has(word));
  };
  const outgoing = toSettle > 0;
  return dataset.transactions
    .filter(
      (transaction) =>
        transaction.type === 'virement' &&
        transaction.accountId === dataset.settings.mainAccountId &&
        transaction.counterpartAccountId === null &&
        !linked.has(transaction.id) &&
        transaction.date >= from &&
        transaction.date <= to &&
        (outgoing ? transaction.amount < 0 : transaction.amount > 0),
    )
    .sort(
      (a, b) =>
        Number(named(b)) - Number(named(a)) ||
        Math.abs(a.amount + toSettle) - Math.abs(b.amount + toSettle) ||
        a.date.localeCompare(b.date),
    );
};
