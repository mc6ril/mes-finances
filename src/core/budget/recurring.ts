import { normalizeLabel } from '../comptes/csvImport';
import { addMonths, dayOf, daysInMonth, monthKeyOf, toIsoDate, parseMonthKey } from '../shared/dates';
import type { Cents, IsoDate, MonthKey, Recurring, Transaction, TransactionType } from '../shared/model';

const isActiveIn = (recurring: Recurring, month: MonthKey): boolean =>
  recurring.active &&
  recurring.startMonth <= month &&
  (recurring.endMonth === null || recurring.endMonth >= month);

const alreadyGenerated = (recurring: Recurring, month: MonthKey, existing: Transaction[]): boolean =>
  existing.some(
    (transaction) => transaction.recurringId === recurring.id && monthKeyOf(transaction.date) === month,
  );

/**
 * Identifiant déterministe : deux appareils qui génèrent le même mois écrivent la même opération,
 * au lieu de la doubler.
 */
export const recurringTransactionId = (recurringId: string, month: MonthKey): string =>
  `rec-${recurringId}-${month}`;

export const materializeRecurring = (
  recurrings: Recurring[],
  month: MonthKey,
  existing: Transaction[],
  now: string,
): Transaction[] => {
  const { year, month: monthNumber } = parseMonthKey(month);
  return recurrings
    .filter((recurring) => isActiveIn(recurring, month))
    .filter((recurring) => !alreadyGenerated(recurring, month, existing))
    .map((recurring) => ({
      id: recurringTransactionId(recurring.id, month),
      date: toIsoDate(year, monthNumber, Math.min(recurring.dayOfMonth, daysInMonth(month))),
      label: recurring.label,
      amount: recurring.amount,
      accountId: recurring.accountId,
      counterpartAccountId: recurring.counterpartAccountId,
      categoryId: recurring.categoryId,
      type: recurring.type,
      status: 'prevu',
      paymentMethod: 'Prélèvement',
      comment: '',
      recurringId: recurring.id,
      createdAt: now,
      updatedAt: now,
    }));
};

export type RecurringSync = { created: Transaction[]; linked: Transaction[]; recurrings: Recurring[] };

const laterMonth = (a: MonthKey, b: MonthKey): MonthKey => (a > b ? a : b);

const earlierMonth = (a: MonthKey, b: MonthKey): MonthKey => (a < b ? a : b);

const pendingMonths = (recurring: Recurring, currentMonth: MonthKey): MonthKey[] => {
  const from = recurring.generatedUntil
    ? laterMonth(recurring.startMonth, addMonths(recurring.generatedUntil, 1))
    : recurring.startMonth;
  const to = recurring.endMonth ? earlierMonth(recurring.endMonth, currentMonth) : currentMonth;
  const months: MonthKey[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
};

const manualMatch = (
  recurring: Recurring,
  month: MonthKey,
  transactions: Transaction[],
  taken: Set<string>,
): Transaction | undefined =>
  transactions.find(
    (transaction) =>
      !transaction.recurringId &&
      !taken.has(transaction.id) &&
      monthKeyOf(transaction.date) === month &&
      transaction.accountId === recurring.accountId &&
      transaction.amount === recurring.amount &&
      transaction.type === recurring.type &&
      transaction.counterpartAccountId === recurring.counterpartAccountId,
  );

export const syncRecurring = (
  recurrings: Recurring[],
  transactions: Transaction[],
  currentMonth: MonthKey,
  now: string,
): RecurringSync => {
  const created: Transaction[] = [];
  const linked: Transaction[] = [];
  const updated: Recurring[] = [];
  const taken = new Set<string>();
  recurrings
    .filter((recurring) => recurring.active)
    .forEach((recurring) => {
      const months = pendingMonths(recurring, currentMonth);
      if (months.length === 0) {
        return;
      }
      months.forEach((month) => {
        const known = [...transactions, ...created];
        if (alreadyGenerated(recurring, month, known)) {
          return;
        }
        const match = manualMatch(recurring, month, transactions, taken);
        if (match) {
          taken.add(match.id);
          linked.push({ ...match, recurringId: recurring.id, updatedAt: now });
          return;
        }
        created.push(...materializeRecurring([recurring], month, known, now));
      });
      updated.push({ ...recurring, generatedUntil: months[months.length - 1] ?? null });
    });
  return { created, linked, recurrings: updated };
};

export const settleDuePlanned = (transactions: Transaction[], today: IsoDate, now: string): Transaction[] =>
  transactions
    .filter((transaction) => transaction.status === 'prevu' && transaction.date <= today)
    .map((transaction) => ({ ...transaction, status: 'realise', updatedAt: now }));

const MIN_CONSECUTIVE_MONTHS = 3;
const AMOUNT_TOLERANCE = 0.1;

const closeAmount = (amount: Cents, reference: Cents): boolean =>
  Math.abs(amount - reference) <= Math.abs(reference) * AMOUNT_TOLERANCE;

export type RecurringSuggestion = {
  key: string;
  label: string;
  amount: Cents;
  type: TransactionType;
  categoryId: string | null;
  accountId: string;
  counterpartAccountId: string | null;
  dayOfMonth: number;
  /** Nombre de mois consécutifs observés. */
  months: number;
  lastMonth: MonthKey;
};

const isCovered = (candidate: Transaction, recurrings: Recurring[]): boolean =>
  recurrings.some(
    (recurring) =>
      recurring.active &&
      recurring.accountId === candidate.accountId &&
      recurring.type === candidate.type &&
      (normalizeLabel(recurring.label) === normalizeLabel(candidate.label) ||
        closeAmount(recurring.amount, candidate.amount)),
  );

/** Suite de mois consécutifs se terminant au dernier mois, au montant proche du dernier. */
const consecutiveRun = (byMonth: Map<MonthKey, Transaction[]>, last: Transaction): number => {
  let count = 0;
  for (let month = monthKeyOf(last.date); ; month = addMonths(month, -1)) {
    const found = byMonth.get(month)?.some((transaction) => closeAmount(transaction.amount, last.amount));
    if (!found) {
      return count;
    }
    count += 1;
  }
};

/**
 * Opérations qui reviennent chaque mois sans récurrence : même compte, même type, même libellé
 * normalisé, montant à ±10 % du dernier, au moins 3 mois consécutifs, la dernière ce mois-ci ou
 * le mois dernier (une série arrêtée depuis longtemps n'est pas proposée).
 */
export const detectRecurring = (
  transactions: Transaction[],
  recurrings: Recurring[],
  today: IsoDate,
): RecurringSuggestion[] => {
  const groups = new Map<string, Transaction[]>();
  transactions
    .filter((transaction) => transaction.status === 'realise' && !transaction.recurringId)
    .filter((transaction) => transaction.date <= today)
    .forEach((transaction) => {
      const label = normalizeLabel(transaction.label);
      if (!label) {
        return;
      }
      const key = `${transaction.accountId}|${transaction.type}|${label}`;
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });
  const oldestLastMonth = addMonths(monthKeyOf(today), -1);
  return [...groups]
    .flatMap(([key, items]) => {
      const last = [...items].sort((a, b) => b.date.localeCompare(a.date))[0]!;
      if (monthKeyOf(last.date) < oldestLastMonth || isCovered(last, recurrings)) {
        return [];
      }
      const byMonth = new Map<MonthKey, Transaction[]>();
      items.forEach((item) =>
        byMonth.set(monthKeyOf(item.date), [...(byMonth.get(monthKeyOf(item.date)) ?? []), item]),
      );
      const months = consecutiveRun(byMonth, last);
      if (months < MIN_CONSECUTIVE_MONTHS) {
        return [];
      }
      return [
        {
          key,
          label: last.label,
          amount: last.amount,
          type: last.type,
          categoryId: last.categoryId,
          accountId: last.accountId,
          counterpartAccountId: last.counterpartAccountId,
          dayOfMonth: dayOf(last.date),
          months,
          lastMonth: monthKeyOf(last.date),
        },
      ];
    })
    .sort((a, b) => b.months - a.months || a.label.localeCompare(b.label));
};

/** Récurrence à créer : elle prend le relais le mois qui suit la dernière opération observée. */
export const recurringFromSuggestion = (suggestion: RecurringSuggestion): Omit<Recurring, 'id'> => ({
  label: suggestion.label,
  amount: suggestion.amount,
  type: suggestion.type,
  categoryId: suggestion.categoryId,
  accountId: suggestion.accountId,
  counterpartAccountId: suggestion.counterpartAccountId,
  dayOfMonth: suggestion.dayOfMonth,
  startMonth: addMonths(suggestion.lastMonth, 1),
  endMonth: null,
  active: true,
});
