import { Check, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { memberLabel, memberSettlement, membersOf, settlementCandidates } from '@/core/commun/household';
import { formatDateFr, formatEuros, monthLabel } from '@/core/shared/format';
import type { HouseholdMember, MonthKey, Settlement } from '@/core/shared/model';
import { Checkbox } from '@/ui/design-system/Field';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { ConfirmDialog, Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';

const KIND_HINT = {
  income: '',
  contribution: '',
  savings: '',
  charge: 'à sa charge',
  avance: 'avancé',
} as const;

type LinkModalProps = { member: HouseholdMember; month: MonthKey; onClose: () => void };

/** Choix des virements du relevé qui règlent le mois : le compte commun n'est pas modifié. */
const LinkTransferModal = ({ member, month, onClose }: LinkModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const candidates = settlementCandidates(dataset, month, member.id);
  const { toSettle } = memberSettlement(dataset, month, member.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates[0] && Math.abs(candidates[0].amount + toSettle) === 0 ? [candidates[0].id] : []),
  );
  const total = candidates
    .filter((transaction) => selected.has(transaction.id))
    .reduce((sum, transaction) => sum - transaction.amount, 0);
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  const confirm = async () => {
    if (await report(finance.linkSettlement(month, member.id, [...selected]), 'Règlement rattaché')) {
      onClose();
    }
  };

  return (
    <Modal
      title={`Virement de ${memberLabel(dataset, member.id)} · ${monthLabel(month)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={selected.size === 0} onClick={() => void confirm()}>
            Rattacher
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Text variant="small">
          Choisis le ou les virements du relevé qui règlent ce mois ({formatEuros(Math.abs(toSettle))}{' '}
          attendus). Aucune opération n’est ajoutée : le relevé fait foi.
        </Text>
        {candidates.length === 0 ? (
          <Text variant="small">
            Aucun virement trouvé entre le début du mois et les deux mois suivants. Importe le relevé du
            compte commun, puis reviens ici.
          </Text>
        ) : (
          <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
            {candidates.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={selected.has(transaction.id)}
                  label={`Rattacher ${transaction.label}`}
                  onChange={(checked) => toggle(transaction.id, checked)}
                />
                <span className="w-24 shrink-0 text-sm text-stone-500">{formatDateFr(transaction.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{transaction.label}</span>
                <Amount cents={transaction.amount} signed />
              </li>
            ))}
          </ul>
        )}
        {selected.size > 0 && (
          <Text variant="small">
            Sélection : {formatEuros(Math.abs(total))}
            {total !== toSettle &&
              ` · écart ${formatEuros(Math.abs(toSettle - total))}, reporté sur le mois suivant`}
          </Text>
        )}
      </div>
    </Modal>
  );
};

type MemberBlockProps = { member: HouseholdMember; month: MonthKey };

const MemberBlock = ({ member, month }: MemberBlockProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [confirming, setConfirming] = useState(false);
  const [toCancel, setToCancel] = useState<Settlement | null>(null);
  const name = memberLabel(dataset, member.id);
  const settlement = memberSettlement(dataset, month, member.id);
  const done = dataset.settlements.filter((item) => item.month === month && item.memberId === member.id);
  const amount = settlement.toSettle;
  const direction =
    amount > 0 ? `Le commun verse à ${name}` : amount < 0 ? `${name} verse au commun` : 'Rien à régler';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Text variant="strong">{name}</Text>
          <Text variant="caption">
            {member.salaryOnCommon ? 'Salaire versé sur le commun' : 'Salaire versé sur son compte'}
          </Text>
        </div>
        {done.length > 0 && amount === 0 && <Badge tone="good">Réglé</Badge>}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {settlement.lines.map((line, index) => (
          <li key={line.transactionId ?? `${line.kind}-${index}`} className="flex justify-between gap-2">
            <span className="min-w-0 truncate text-stone-600 dark:text-stone-300">
              {line.label}
              {KIND_HINT[line.kind] && (
                <span className="text-stone-400">
                  {' '}
                  · {line.kind === 'charge' && line.amount > 0 ? 'reçu pour lui' : KIND_HINT[line.kind]}
                </span>
              )}
            </span>
            <Amount cents={line.amount} signed />
          </li>
        ))}
        {settlement.carriedOver !== 0 && (
          <li className="flex justify-between gap-2">
            <span className="text-stone-600 dark:text-stone-300">Reste des mois précédents</span>
            <Amount cents={settlement.carriedOver} signed />
          </li>
        )}
        {done.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-stone-600 dark:text-stone-300">
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              Réglé le {formatDateFr(item.date)}
            </span>
            <span className="flex items-center gap-1">
              <Amount cents={-item.amount} signed />
              <Button
                size="sm"
                variant="ghost"
                icon={Undo2}
                label="Annuler ce règlement"
                onClick={() => setToCancel(item)}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        <div>
          <Text variant="label">{direction}</Text>
          <Text variant="strong" className="mt-0.5 text-lg">
            <Amount cents={Math.abs(amount)} />
          </Text>
        </div>
        {amount !== 0 && (
          <Button size="sm" variant="primary" icon={Check} onClick={() => setConfirming(true)}>
            Virement fait
          </Button>
        )}
      </div>
      {confirming && <LinkTransferModal member={member} month={month} onClose={() => setConfirming(false)} />}
      {toCancel && (
        <ConfirmDialog
          title="Annuler ce règlement ?"
          message="Le virement reste sur le compte commun ; il n’est simplement plus rattaché à ce mois."
          confirmLabel="Annuler le règlement"
          onCancel={() => setToCancel(null)}
          onConfirm={() => {
            void report(finance.cancelSettlement(toCancel), 'Règlement annulé');
            setToCancel(null);
          }}
        />
      )}
    </div>
  );
};

/** Règlement de fin de mois : ce que chacun reçoit du commun ou lui verse. */
const SettlementCard = ({ month }: { month: MonthKey }) => {
  const dataset = useDataset();
  return (
    <Card
      title="Règlement de fin de mois"
      subtitle="Revenus arrivés sur le commun − part de chacun − dépenses à sa charge + dépenses avancées"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {membersOf(dataset).map((member) => (
          <MemberBlock key={member.id} member={member} month={month} />
        ))}
      </div>
    </Card>
  );
};

export default SettlementCard;
