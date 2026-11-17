import { isInternalMove } from '../comptes/balances';
import { monthEnd, parseFlexibleDate } from '../shared/dates';
import type {
  Account,
  Cents,
  IsoDate,
  MonthKey,
  SavingsMovement,
  SavingsMovementKind,
  Transaction,
  Valuation,
} from '../shared/model';
import { parseEuros } from '../shared/money';
import { accountPosition, type PatrimoineContext, transactionEffectOn } from './patrimoine';

/** Sens d'un mouvement saisi sur la valeur du compte. */
export const MOVEMENT_SIGN: Record<SavingsMovementKind, 1 | -1> = {
  versement: 1,
  interets: 1,
  retrait: -1,
  frais: -1,
};

type EntryBase = { id: string; date: IsoDate; amount: Cents };

/** Ligne de l'historique d'un compte d'épargne : seuls mouvements et valorisations se suppriment ici. */
export type HistoryEntry =
  | (EntryBase & { kind: 'movement'; movement: SavingsMovement })
  | (EntryBase & { kind: 'valuation'; valuation: Valuation })
  | (EntryBase & { kind: 'transfer'; label: string });

type HistorySource = {
  accounts: Account[];
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  valuations: Valuation[];
};

/** Libellé d'une opération : un virement nomme l'autre compte (d'où vient ou où va l'argent). */
const transferLabel = (accountId: string, transaction: Transaction, accounts: Account[]): string => {
  if (!isInternalMove(transaction)) {
    return transaction.label;
  }
  const incoming = transaction.counterpartAccountId === accountId;
  const otherId = incoming ? transaction.accountId : transaction.counterpartAccountId;
  const other = accounts.find((account) => account.id === otherId);
  if (!other) {
    return transaction.label;
  }
  return `${transaction.label} (${incoming ? 'depuis' : 'vers'} ${other.name})`;
};

/**
 * Historique d'un compte d'épargne, du plus récent au plus ancien : mouvements saisis, valorisations
 * et opérations passées qui changent sa valeur (virements reçus comme envoyés).
 */
export const accountHistory = (account: Account, source: HistorySource): HistoryEntry[] => {
  const movements: HistoryEntry[] = source.savingsMovements
    .filter((movement) => movement.accountId === account.id)
    .map((movement) => ({
      kind: 'movement',
      id: movement.id,
      date: movement.date,
      amount: MOVEMENT_SIGN[movement.kind] * movement.amount,
      movement,
    }));
  const valuations: HistoryEntry[] = source.valuations
    .filter((valuation) => valuation.accountId === account.id)
    .map((valuation) => ({
      kind: 'valuation',
      id: valuation.id,
      date: valuation.date,
      amount: valuation.value,
      valuation,
    }));
  const transfers = source.transactions.flatMap((transaction): HistoryEntry[] => {
    const effect = transactionEffectOn(account.id, transaction);
    if (effect === null) {
      return [];
    }
    return [
      {
        kind: 'transfer',
        id: transaction.id,
        date: transaction.date,
        amount: effect,
        label: transferLabel(account.id, transaction, source.accounts),
      },
    ];
  });
  return [...movements, ...valuations, ...transfers].sort((a, b) => b.date.localeCompare(a.date));
};

export type AccountPoint = { month: MonthKey; valeur: Cents; verse: Cents };

/** Valeur et versé net du compte en fin de chaque mois (une position calculée par mois). */
export const accountSeries = (
  account: Account,
  context: PatrimoineContext,
  months: MonthKey[],
): AccountPoint[] =>
  months.map((month) => {
    const position = accountPosition(account, context, monthEnd(month));
    return { month, valeur: position.value, verse: position.contributions };
  });

export type SavingsEntryKind = 'movement' | 'valuation';

/**
 * Saisie d'un mouvement ou d'une valorisation : date lisible et montant positif. Un mouvement de 0 €
 * ne change rien et est refusé ; une valorisation à 0 € (compte vidé) reste possible.
 */
export const validateSavingsEntry = (
  kind: SavingsEntryKind,
  date: string,
  amount: string,
): { date: IsoDate; cents: Cents } | null => {
  const parsedDate = parseFlexibleDate(date);
  const cents = parseEuros(amount);
  if (!parsedDate || cents === null || cents < 0 || (kind === 'movement' && cents === 0)) {
    return null;
  }
  return { date: parsedDate, cents };
};
