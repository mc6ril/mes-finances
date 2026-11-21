import { isSavingsAccount } from '../comptes/accounts';
import { isCounted } from '../comptes/balances';
import { isMirrored } from '../comptes/mirror';
import { addMonths } from '../shared/dates';
import type {
  Account,
  Cents,
  CommonMonth,
  Dataset,
  Household,
  HouseholdMember,
  MonthKey,
  SavingsMovement,
  SavingsRate,
  Settlement,
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

/** Valeur du réglage quand l'épargne part du compte commun. */
export const SAVINGS_FROM_COMMON = 'commun';

/**
 * Qui verse l'épargne du mois : le réglage s'il est fait, sinon le premier membre dont le
 * salaire n'arrive pas sur le commun (il alimente les livrets depuis son compte), sinon le commun.
 */
export const savingsPayerOf = (household: Household | null): string | null => {
  if (!household) {
    return null;
  }
  if (household.savingsPaidBy === SAVINGS_FROM_COMMON) {
    return null;
  }
  const chosen = household.members.find((member) => member.id === household.savingsPaidBy);
  return chosen?.id ?? household.members.find((member) => !member.salaryOnCommon)?.id ?? null;
};

export const membersOf = (dataset: Dataset): HouseholdMember[] => dataset.settings.household?.members ?? [];

/** Nom par défaut d'un membre dont le prénom n'est pas renseigné : « Membre 1 », « Membre 2 ». */
export const defaultMemberName = (index: number): string => `Membre ${index + 1}`;

/** Prénom du membre, ou « Membre 1 / 2 » tant qu'il n'est pas renseigné. */
export const memberName = (members: HouseholdMember[], memberId: string): string => {
  const index = members.findIndex((member) => member.id === memberId);
  return members[index]?.name.trim() || defaultMemberName(index);
};

/** Nom affiché d'un membre du foyer de l'espace. */
export const memberLabel = (dataset: Dataset, memberId: string): string =>
  memberName(membersOf(dataset), memberId);

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

/** Autres entrées : revenus du commun, rattachés à personne (intérêts…). */
const otherInflows = (transactions: Transaction[], month: MonthKey): Cents =>
  revenuesIn(transactions, month)
    .filter((transaction) => !transaction.imputation)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

/**
 * Remboursements reçus par un membre sur son compte et saisis sur un livret du commun : il les a
 * versés directement à l'épargne, rien n'arrive sur le compte commun.
 */
const savedRefunds = (dataset: Dataset, month: MonthKey): Transaction[] => {
  const savingsAccounts = new Set(
    dataset.accounts.filter((account) => isSavingsAccount(account)).map((account) => account.id),
  );
  return dataset.transactions.filter(
    (transaction) =>
      transaction.type === 'depense' &&
      transaction.amount > 0 &&
      transaction.imputation?.kind === 'avance' &&
      isCounted(transaction) &&
      inMonth(transaction, month) &&
      savingsAccounts.has(transaction.accountId),
  );
};

/** Valeur de « Arrivé sur » quand un retrait d'épargne arrive directement sur le compte commun. */
export const RECEIVED_ON_COMMON = 'commun';

/**
 * Retraits du mois sur un livret, quand un membre détient l'épargne. Rien quand l'épargne part du
 * compte commun.
 */
const savingsWithdrawals = (dataset: Dataset, month: MonthKey): SavingsMovement[] => {
  if (!savingsPayerOf(dataset.settings.household)) {
    return [];
  }
  const savingsAccounts = new Set(
    dataset.accounts.filter((account) => isSavingsAccount(account)).map((account) => account.id),
  );
  return dataset.savingsMovements.filter(
    (movement) =>
      movement.kind === 'retrait' &&
      movement.date.startsWith(month) &&
      savingsAccounts.has(movement.accountId),
  );
};

/**
 * Membre sur le compte duquel un retrait est arrivé : il le doit au commun. Null : arrivé sur le
 * compte commun, rien de dû. Par défaut, le détenteur de l'épargne, ou le commun si un virement
 * miroir le montre.
 */
export const withdrawalRecipient = (dataset: Dataset, movement: SavingsMovement): string | null => {
  const { receivedBy } = movement;
  if (receivedBy === RECEIVED_ON_COMMON) {
    return null;
  }
  if (receivedBy && membersOf(dataset).some((member) => member.id === receivedBy)) {
    return receivedBy;
  }
  return isMirrored(movement, dataset.transactions) ? null : savingsPayerOf(dataset.settings.household);
};

/** « Arrivé sur » se renseigne pour un retrait d'un livret, quand un membre détient l'épargne du commun. */
export const tracksWithdrawalRecipient = (dataset: Dataset, account: { group: Account['group'] }): boolean =>
  dataset.settings.kind === 'commun' &&
  isSavingsAccount(account) &&
  savingsPayerOf(dataset.settings.household) !== null;

const WITHDRAWAL_LABEL = 'Retrait d’épargne';

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
  /** Épargne du mois selon les taux, à verser sur les livrets. */
  savingsTotal: Cents;
  /** Remboursements reçus par un membre et placés directement sur un livret. */
  savedRefunds: Cents;
  /** Retraits d'épargne du mois, dus au commun par le membre qui détient les livrets. */
  withdrawals: Cents;
  /** Toute l'épargne du mois : taux et remboursements placés. */
  totalSaved: Cents;
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
  const refunds = savedRefunds(dataset, month).reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawals = savingsWithdrawals(dataset, month).reduce((sum, movement) => sum + movement.amount, 0);
  const available = envelope + carriedOver + inflows + withdrawals - savingsTotal - refunds;
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
    savedRefunds: refunds,
    withdrawals,
    totalSaved: savingsTotal + refunds,
    available,
    expenses,
    balance: available - expenses,
  };
};

/** Mois du commun ; le bilan de chaque mois est reporté sur le suivant depuis le premier mois suivi. */
export const commonMonthSummary = (dataset: Dataset, month: MonthKey): CommonMonthSummary => {
  const first = firstTrackedMonth(dataset);
  if (!first || month < first) {
    return singleMonth(dataset, month, 0);
  }
  let carried = 0;
  for (let current = first; current < month; current = addMonths(current, 1)) {
    carried = singleMonth(dataset, current, carried).balance;
  }
  return singleMonth(dataset, month, carried);
};

export type SettlementLine = {
  kind: 'income' | 'contribution' | 'savings' | 'withdrawal' | 'charge' | 'avance' | 'adjustment';
  label: string;
  /** Positif : le commun doit au membre ; négatif : le membre doit au commun. */
  amount: Cents;
  transactionId?: string;
  movementId?: string;
  adjustmentId?: string;
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
    // Épargne versée par ce membre depuis son compte : elle compte dans sa part.
    ...(savingsPayerOf(dataset.settings.household) === member.id && summary.savingsTotal > 0
      ? [{ kind: 'savings' as const, label: 'Épargne versée sur les livrets', amount: summary.savingsTotal }]
      : []),
    // Remboursement reçu sur son compte et versé au livret : il ne le doit plus au commun.
    ...savedRefunds(dataset, month)
      .filter((transaction) => transaction.imputation?.memberId === member.id)
      .map((transaction) => ({
        kind: 'savings' as const,
        label: transaction.label,
        amount: transaction.amount,
        transactionId: transaction.id,
      })),
    // Retrait d'épargne arrivé sur son compte : il le doit au commun.
    ...savingsWithdrawals(dataset, month)
      .filter((movement) => withdrawalRecipient(dataset, movement) === member.id)
      .map((movement) => ({
        kind: 'withdrawal' as const,
        label: movement.comment.trim() || WITHDRAWAL_LABEL,
        amount: -movement.amount,
        movementId: movement.id,
      })),
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
    ...(commonMonthOf(dataset, month).adjustments ?? [])
      .filter((adjustment) => adjustment.memberId === member.id)
      .map((adjustment) => ({
        kind: 'adjustment' as const,
        label: adjustment.label,
        amount: adjustment.amount,
        adjustmentId: adjustment.id,
      })),
  ];
};

const dueOf = (dataset: Dataset, month: MonthKey, member: HouseholdMember): Cents =>
  settlementLines(dataset, month, member).reduce((sum, line) => sum + line.amount, 0);

/** Règlements faits pour un membre au titre d'un mois. */
export const settlementsOf = (dataset: Dataset, month: MonthKey, memberId: string): Settlement[] =>
  dataset.settlements.filter((settlement) => settlement.month === month && settlement.memberId === memberId);

const settledIn = (dataset: Dataset, month: MonthKey, memberId: string): Cents =>
  settlementsOf(dataset, month, memberId).reduce((sum, settlement) => sum + settlement.amount, 0);

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
