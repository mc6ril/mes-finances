import type { IsoDate, Transaction } from '../shared/model';

/** Opérations prévues dont la date est passée : elles passent au statut « Passé ». */
export const settleDuePlanned = (transactions: Transaction[], today: IsoDate, now: string): Transaction[] =>
  transactions
    .filter((transaction) => transaction.status === 'prevu' && transaction.date <= today)
    .map((transaction) => ({ ...transaction, status: 'realise', updatedAt: now }));
