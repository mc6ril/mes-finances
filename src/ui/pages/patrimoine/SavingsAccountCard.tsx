import { ChevronRight } from 'lucide-react';
import { formatDateFr } from '@/core/shared/format';
import type { Account } from '@/core/shared/model';
import type { AccountPosition } from '@/core/patrimoine/patrimoine';
import { ACCOUNT_KIND_LABELS } from '@/ui/constants';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Text from '@/ui/design-system/Text';
import { MUTED_TEXT } from '@/ui/design-system/textColors';

type SavingsAccountCardProps = {
  account: Account;
  position: AccountPosition;
  color: string;
  onOpen: () => void;
};

/** Carte d'un compte d'épargne : valeur, versé net, intérêts, frais et plus/moins-value. */
const SavingsAccountCard = ({ account, position, color, onOpen }: SavingsAccountCardProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="group flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 text-left shadow-card transition hover:border-brand-300 dark:border-stone-800 dark:bg-[#1c1c1b] dark:hover:border-brand-500/50"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
        <Text variant="strong">{account.name}</Text>
      </div>
      <ChevronRight
        className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"
        aria-hidden
      />
    </div>
    <div className="text-xl font-semibold tracking-tight">
      <Amount cents={position.value} />
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <dt className={MUTED_TEXT}>Versé net</dt>
      <dd className="text-right tabular-nums">
        <Amount cents={position.contributions} />
      </dd>
      <dt className={MUTED_TEXT}>Intérêts</dt>
      <dd className="text-right">
        <Amount cents={position.interests} />
      </dd>
      <dt className={MUTED_TEXT}>Frais</dt>
      <dd className="text-right">
        <Amount cents={-position.fees} />
      </dd>
      <dt className={MUTED_TEXT}>Plus/moins-value</dt>
      <dd className="text-right">
        <Amount cents={position.marketGain} signed colored />
      </dd>
    </dl>
    <div className="flex flex-wrap gap-1.5">
      <Badge>{ACCOUNT_KIND_LABELS[account.kind]}</Badge>
      {position.valuationDate && (
        <Badge tone="info">Valorisé le {formatDateFr(position.valuationDate)}</Badge>
      )}
    </div>
  </button>
);

export default SavingsAccountCard;
