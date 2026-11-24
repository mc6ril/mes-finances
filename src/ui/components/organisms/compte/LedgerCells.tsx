import { isOutsideAccount, isVerified, signedEffectOn } from '@/core/comptes/balances';
import type { Transaction } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import type { BadgeTone } from '@/ui/components/atoms/Badge';

/** Partagé par le tableau (web) et la liste (mobile). */
export const statusTone = (transaction: Transaction): BadgeTone => {
  if (transaction.status === 'prevu') {
    return 'info';
  }
  return isVerified(transaction) ? 'good' : 'neutral';
};

type RowAmountProps = { row: Transaction; accountId: string };

/** Montant vu depuis le compte ; grisé s'il ne change pas le solde. */
export const RowAmount = ({ row, accountId }: RowAmountProps) =>
  isOutsideAccount(row) ? (
    <span title="Hors du compte : ne change pas le solde">
      <Amount cents={row.amount} className="text-ink-muted" />
    </span>
  ) : (
    <Amount cents={signedEffectOn(accountId, row)} colored />
  );
