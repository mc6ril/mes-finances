import { daysInMonth, monthKeyOf, toIsoDate, parseMonthKey } from './dates';
import type { MonthKey, Recurring, Transaction } from './model';

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
