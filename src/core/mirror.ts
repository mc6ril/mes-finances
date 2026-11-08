import { isCounted, isInternalMove } from './balances';
import { daysBetween } from './dates';
import type { Cents, IsoDate, SavingsMovementKind, Transaction } from './model';

export type MovementLike = { accountId: string; date: IsoDate; kind: SavingsMovementKind; amount: Cents };

const MIRROR_DAY_WINDOW = 3;

const EXPECTED_SIGN: Partial<Record<SavingsMovementKind, 1 | -1>> = { versement: 1, retrait: -1 };

export const mirroringTransfer = (
  movement: MovementLike,
  transactions: Transaction[],
): Transaction | null => {
  const sign = EXPECTED_SIGN[movement.kind];
  if (!sign) {
    return null;
  }
  return (
    transactions.find(
      (transaction) =>
        transaction.counterpartAccountId === movement.accountId &&
        isInternalMove(transaction) &&
        isCounted(transaction) &&
        -transaction.amount === sign * movement.amount &&
        Math.abs(daysBetween(transaction.date, movement.date)) <= MIRROR_DAY_WINDOW,
    ) ?? null
  );
};

export const isMirrored = (movement: MovementLike, transactions: Transaction[]): boolean =>
  mirroringTransfer(movement, transactions) !== null;
