import type { ReactNode } from 'react';
import { cashflowSummary, livePosition, periodPhase } from '@/core/comptes/balances';
import { formatDateFr } from '@/core/shared/format';
import type { Account, IsoDate, Transaction } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Card from '@/ui/design-system/Card';
import { cx } from '@/ui/design-system/cx';
import Text from '@/ui/design-system/Text';

type SummaryCardProps = { label: string; value: ReactNode; caption?: ReactNode; valueClassName?: string };

const SummaryCard = ({ label, value, caption, valueClassName }: SummaryCardProps) => (
  <Card>
    <Text variant="label">{label}</Text>
    <div className={cx('mt-1 text-lg font-semibold', valueClassName)}>{value}</div>
    {caption && <Text variant="caption">{caption}</Text>}
  </Card>
);

const INFLOW_TONE = 'text-emerald-600 dark:text-emerald-400';
const OUTFLOW_TONE = 'text-red-600 dark:text-red-400';

type SummaryCardsProps = {
  account: Account;
  transactions: Transaction[];
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
};

type PeriodProps = Omit<SummaryCardsProps, 'today'>;

/** Mois en cours : solde vérifié, à venir et projection fin de mois. */
const CurrentPeriodCards = ({ account, transactions, from, to }: PeriodProps) => {
  const position = livePosition(account, transactions, from, to);
  return (
    <>
      <SummaryCard
        label="Solde initial"
        value={<Amount cents={position.opening} />}
        caption={`au ${formatDateFr(from)}`}
      />
      <SummaryCard
        label="Solde actuel"
        value={<Amount cents={position.current} />}
        caption="opérations vérifiées sur ton relevé"
        valueClassName="text-brand-600 dark:text-brand-300"
      />
      <SummaryCard
        label="À venir"
        value={<Amount cents={position.upcoming} signed colored />}
        caption={
          <>
            passé à vérifier <Amount cents={position.realised} signed /> · prévu{' '}
            <Amount cents={position.planned} signed />
          </>
        }
      />
      <SummaryCard
        label="Fin de mois projetée"
        value={<Amount cents={position.projected} />}
        caption={`au ${formatDateFr(to)}`}
      />
    </>
  );
};

/** Période passée (réel) ou future (projetée avec les prévues). */
const ClosedPeriodCards = ({
  account,
  transactions,
  from,
  to,
  projected,
}: PeriodProps & { projected: boolean }) => {
  const summary = cashflowSummary(account, transactions, from, to, { includePlanned: projected });
  const withPlanned = cashflowSummary(account, transactions, from, to, { includePlanned: true });
  const suffix = projected ? ' projeté' : '';
  return (
    <>
      <SummaryCard
        label={`Solde initial${suffix}`}
        value={<Amount cents={summary.opening} />}
        caption={`au ${formatDateFr(from)}`}
      />
      <SummaryCard
        label={projected ? 'Entrées prévues' : 'Entrées'}
        value={<Amount cents={summary.inflows} signed />}
        valueClassName={INFLOW_TONE}
      />
      <SummaryCard
        label={projected ? 'Sorties prévues' : 'Sorties'}
        value={<Amount cents={-summary.outflows} />}
        valueClassName={OUTFLOW_TONE}
      />
      <SummaryCard
        label={`Solde final${suffix}`}
        value={<Amount cents={summary.closing} />}
        caption={
          !projected && withPlanned.closing !== summary.closing ? (
            <>
              avec prévus : <Amount cents={withPlanned.closing} />
            </>
          ) : undefined
        }
      />
    </>
  );
};

const SummaryCards = ({ today, ...period }: SummaryCardsProps) => {
  const phase = periodPhase(period.from, period.to, today);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {phase === 'current' ? (
        <CurrentPeriodCards {...period} />
      ) : (
        <ClosedPeriodCards {...period} projected={phase === 'future'} />
      )}
    </div>
  );
};

export default SummaryCards;
