import { addMonths, daysInMonth, monthKeyOf, toIsoDate, parseMonthKey } from '../shared/dates';
import type { IsoDate, MonthKey, Recurring, Transaction } from '../shared/model';

const isActiveIn = (recurring: Recurring, month: MonthKey): boolean =>
  recurring.active &&
  recurring.startMonth <= month &&
  (recurring.endMonth === null || recurring.endMonth >= month);

const alreadyGenerated = (recurring: Recurring, month: MonthKey, existing: Transaction[]): boolean =>
  existing.some(
    (transaction) => transaction.recurringId === recurring.id && monthKeyOf(transaction.date) === month,
  );

export const materializeRecurring = (
  recurrings: Recurring[],
  month: MonthKey,
  existing: Transaction[],
  newId: () => string,
  now: string,
): Transaction[] => {
  const { year, month: monthNumber } = parseMonthKey(month);
  return recurrings
    .filter((recurring) => isActiveIn(recurring, month))
    .filter((recurring) => !alreadyGenerated(recurring, month, existing))
    .map((recurring) => ({
      id: newId(),
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
  newId: () => string,
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
        created.push(...materializeRecurring([recurring], month, known, newId, now));
      });
      updated.push({ ...recurring, generatedUntil: months[months.length - 1] ?? null });
    });
  return { created, linked, recurrings: updated };
};

export const settleDuePlanned = (transactions: Transaction[], today: IsoDate, now: string): Transaction[] =>
  transactions
    .filter((transaction) => transaction.status === 'prevu' && transaction.date <= today)
    .map((transaction) => ({ ...transaction, status: 'realise', updatedAt: now }));
