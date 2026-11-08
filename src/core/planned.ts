import type { IsoDate, Transaction } from './model';

export const settleDuePlanned = (transactions: Transaction[], today: IsoDate, now: string): Transaction[] =>
  transactions
    .filter((transaction) => transaction.status === 'prevu' && transaction.date <= today)
    .map((transaction) => ({ ...transaction, status: 'realise', updatedAt: now }));
