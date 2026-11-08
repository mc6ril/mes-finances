import { addDays } from './dates';
import type { Account, Cents, IsoDate, Transaction, TransactionStatus } from './model';

export const isCounted = (transaction: Transaction): boolean => transaction.status !== 'prevu';

export const isInternalMove = (transaction: Transaction): boolean =>
  transaction.type === 'virement' || transaction.type === 'investissement';

export const signedEffectOn = (accountId: string, transaction: Transaction): Cents => {
  if (transaction.accountId === accountId) {
    return transaction.amount;
  }
  if (transaction.counterpartAccountId === accountId && isInternalMove(transaction)) {
    return -transaction.amount;
  }
  return 0;
};

type BalanceOptions = { includePlanned?: boolean };

const isIncluded = (transaction: Transaction, options: BalanceOptions): boolean =>
  options.includePlanned === true || isCounted(transaction);

const effectsBetween = (
  account: Account,
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
  options: BalanceOptions,
): Cents[] =>
  transactions
    .filter((transaction) => transaction.date >= from && transaction.date <= to)
    .filter((transaction) => transaction.date >= account.openingDate)
    .filter((transaction) => isIncluded(transaction, options))
    .map((transaction) => signedEffectOn(account.id, transaction))
    .filter((effect) => effect !== 0);

export const accountBalanceAt = (
  account: Account,
  transactions: Transaction[],
  date: IsoDate,
  options: BalanceOptions = {},
): Cents => {
  if (date < account.openingDate) {
    return 0;
  }
  return effectsBetween(account, transactions, account.openingDate, date, options).reduce(
    (balance, effect) => balance + effect,
    account.openingBalance,
  );
};

export type CashflowSummary = { opening: Cents; inflows: Cents; outflows: Cents; closing: Cents };

const balanceBefore = (
  account: Account,
  transactions: Transaction[],
  date: IsoDate,
  options: BalanceOptions,
): Cents => {
  if (date <= account.openingDate) {
    return account.openingBalance;
  }
  return accountBalanceAt(account, transactions, addDays(date, -1), options);
};

export const cashflowSummary = (
  account: Account,
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
  options: BalanceOptions = {},
): CashflowSummary => {
  if (to < account.openingDate) {
    return { opening: 0, inflows: 0, outflows: 0, closing: 0 };
  }
  const opening = balanceBefore(account, transactions, from, options);
  const effects = effectsBetween(account, transactions, from, to, options);
  const inflows = effects.filter((effect) => effect > 0).reduce((total, effect) => total + effect, 0);
  const outflows = effects.filter((effect) => effect < 0).reduce((total, effect) => total - effect, 0);
  return { opening, inflows, outflows, closing: opening + inflows - outflows };
};

export type PeriodPhase = 'past' | 'current' | 'future';

export const periodPhase = (from: IsoDate, to: IsoDate, today: IsoDate): PeriodPhase => {
  if (to < today) {
    return 'past';
  }
  if (from > today) {
    return 'future';
  }
  return 'current';
};

export type LivePosition = {
  opening: Cents;
  current: Cents;
  realised: Cents;
  planned: Cents;
  upcoming: Cents;
  projected: Cents;
};

export const livePosition = (
  account: Account,
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
): LivePosition => {
  if (to < account.openingDate) {
    return { opening: 0, current: 0, realised: 0, planned: 0, upcoming: 0, projected: 0 };
  }
  const opening = balanceBefore(account, transactions, from, {});
  const inRange = transactions.filter(
    (transaction) =>
      transaction.date >= from && transaction.date <= to && transaction.date >= account.openingDate,
  );
  const totalOf = (status: TransactionStatus): Cents =>
    inRange
      .filter((transaction) => transaction.status === status)
      .reduce((total, transaction) => total + signedEffectOn(account.id, transaction), 0);
  const current = opening + totalOf('rapproche');
  const realised = totalOf('realise');
  const planned = totalOf('prevu');
  const upcoming = realised + planned;
  return { opening, current, realised, planned, upcoming, projected: current + upcoming };
};

export type BalancePoint = { date: IsoDate; balance: Cents };

export const balanceSeries = (
  account: Account,
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
  options: BalanceOptions = {},
): BalancePoint[] => {
  const byDate = new Map<IsoDate, Cents>();
  transactions
    .filter(
      (transaction) =>
        transaction.date >= from && transaction.date <= to && transaction.date >= account.openingDate,
    )
    .filter((transaction) => isIncluded(transaction, options))
    .forEach((transaction) => {
      byDate.set(
        transaction.date,
        (byDate.get(transaction.date) ?? 0) + signedEffectOn(account.id, transaction),
      );
    });
  const points: BalancePoint[] = [];
  let balance = accountBalanceAt(account, transactions, addDays(from, -1), options);
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date === account.openingDate) {
      balance = account.openingBalance;
    }
    balance += byDate.get(date) ?? 0;
    points.push({ date, balance });
  }
  return points;
};
