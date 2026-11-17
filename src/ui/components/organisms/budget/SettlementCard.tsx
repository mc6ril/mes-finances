import { Check, Plus, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { memberLabel, memberSettlement, membersOf, settlementCandidates } from '@/core/commun/household';
import {
  adjustmentDraft,
  defaultSettlementSelection,
  settlementSelection,
  type AdjustmentDirection,
  type SettledPayment,
  type SettlementGroup,
  type SettlementGroupKey,
} from '@/core/commun/settlement';
import { formatDateFr, formatEuros, monthLabel } from '@/core/shared/format';
import type { HouseholdMember, MonthKey } from '@/core/shared/model';
import type { SettlementLine } from '@/core/commun/household';
import { useMemberSettlement } from '@/hooks/commun/useMemberSettlement';
import TransactionModal from '@/ui/components/organisms/modals/TransactionModal';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { Field } from '@/ui/components/molecules/form/Field';
import { Input } from '@/ui/components/atoms/form/Input';
import MoneyInput from '@/ui/components/molecules/form/MoneyInput';
import Segmented from '@/ui/components/molecules/Segmented';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import { ConfirmDialog } from '@/ui/components/molecules/overlays/ConfirmDialog';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Text from '@/ui/components/atoms/Text';

type LinkModalProps = { member: HouseholdMember; month: MonthKey; onClose: () => void };

/** Choix des virements du relevé qui règlent le mois : le compte commun n'est pas modifié. */
const LinkTransferModal = ({ member, month, onClose }: LinkModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const candidates = settlementCandidates(dataset, month, member.id);
  const { toSettle } = memberSettlement(dataset, month, member.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSettlementSelection(candidates, toSettle)),
  );
  const { total, gap } = settlementSelection(candidates, selected, toSettle);
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
          <ul className="flex flex-col divide-y divide-line">
            {candidates.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={selected.has(transaction.id)}
                  label={`Rattacher ${transaction.label}`}
                  onChange={(checked) => toggle(transaction.id, checked)}
                />
                <Text variant="muted" as="span" className="w-24 shrink-0">
                  {formatDateFr(transaction.date)}
                </Text>
                <span className="min-w-0 flex-1 truncate text-sm">{transaction.label}</span>
                <Amount cents={transaction.amount} signed />
              </li>
            ))}
          </ul>
        )}
        {selected.size > 0 && (
          <Text variant="small">
            Sélection : {formatEuros(Math.abs(total))}
            {gap !== 0 && ` · écart ${formatEuros(Math.abs(gap))}, reporté sur le mois suivant`}
          </Text>
        )}
      </div>
    </Modal>
  );
};

/** Dette entre un membre et le commun, réglée hors compte : elle ne compte que dans le règlement. */
const AdjustmentModal = ({ member, month, onClose }: LinkModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const name = memberLabel(dataset, member.id);
  const [label, setLabel] = useState('');
  const [cents, setCents] = useState(0);
  const [direction, setDirection] = useState<AdjustmentDirection>('owes');
  const draft = adjustmentDraft(direction, label, cents);
  const save = async () => {
    if (!draft) {
      return;
    }
    if (await report(finance.addAdjustment(month, { memberId: member.id, ...draft }), 'Ajustement ajouté')) {
      onClose();
    }
  };

  return (
    <Modal
      title={`Ajustement · ${name} · ${monthLabel(month)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!draft} onClick={() => void save()}>
            Ajouter
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Text variant="small">
          Une somme que {name} doit au commun, ou l’inverse, sans mouvement sur le compte commun. Elle compte
          seulement dans le règlement du mois, pas dans les opérations ni dans le budget.
        </Text>
        <Segmented<AdjustmentDirection>
          label="Sens de l’ajustement"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'owes', label: `${name} doit au commun` },
            { value: 'owed', label: `Le commun doit à ${name}` },
          ]}
        />
        <Field label="Libellé">
          <Input value={label} onChange={setLabel} placeholder="Abonnement, part d’un achat…" autoFocus />
        </Field>
        <Field label="Montant">
          <MoneyInput cents={cents} onCommit={setCents} label="Montant de l’ajustement" />
        </Field>
      </div>
    </Modal>
  );
};

const GROUP_LABELS: Record<SettlementGroupKey, (name: string) => string> = {
  income: () => 'Revenus arrivés sur le commun',
  contribution: () => 'Part du commun',
  savings: () => 'Épargne versée sur les livrets',
  avance: () => 'Payé pour le commun depuis son compte',
  charge: (name) => `Payé par le commun pour ${name}`,
  received: (name) => `Reçu sur le commun pour ${name}`,
  adjustment: () => 'Ajustements hors compte',
};

/**
 * Récap du règlement, même structure pour chaque membre. Un membre dont le salaire arrive sur
 * le commun le lit du côté de ce que le commun lui doit ; un membre payé ailleurs, du côté de ce
 * qu'il doit au commun (sa part en positif). Les groupes et leurs montants viennent de core/commun.
 */
const SettlementLines = ({
  name,
  groups,
  owes,
  carriedOver,
  onRemoveAdjustment,
}: {
  name: string;
  groups: SettlementGroup[];
  owes: boolean;
  carriedOver: number;
  onRemoveAdjustment: (line: SettlementLine) => void;
}) => (
  <>
    {groups.map((group) => (
      <li key={group.key} className="flex flex-col gap-0.5">
        <span className="flex justify-between gap-2">
          <span className="text-ink-secondary">{GROUP_LABELS[group.key](name)}</span>
          <Amount cents={group.total} signed={!(owes && group.key === 'contribution')} />
        </span>
        {group.detailed &&
          group.lines.map((line, index) => (
            <Text
              key={line.transactionId ?? line.adjustmentId ?? index}
              variant="small"
              as="span"
              className="flex items-center justify-between gap-2 pl-3"
            >
              <span className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate">{line.label}</span>
                {line.adjustmentId && (
                  <button
                    type="button"
                    aria-label={`Supprimer l’ajustement ${line.label}`}
                    title="Supprimer l’ajustement"
                    onClick={() => onRemoveAdjustment(line)}
                    className="shrink-0 rounded-sm text-ink-faint hover:text-negative focus-visible:outline-2 focus-visible:outline-accent-bright"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </span>
              <Amount cents={line.shown} signed />
            </Text>
          ))}
      </li>
    ))}
    {carriedOver !== 0 && (
      <li className="flex justify-between gap-2">
        <span className="text-ink-secondary">Reste des mois précédents</span>
        <Amount cents={carriedOver} signed />
      </li>
    )}
  </>
);

type MemberBlockProps = { member: HouseholdMember; month: MonthKey };

const MemberBlock = ({ member, month }: MemberBlockProps) => {
  const view = useMemberSettlement(member, month);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [toRemove, setToRemove] = useState<SettlementLine | null>(null);
  const [toCancel, setToCancel] = useState<SettledPayment | null>(null);
  const { name, owes, payments, defaultDate } = view;
  const amount = view.toSettle;
  const direction =
    amount > 0 ? `Le commun verse à ${name}` : amount < 0 ? `${name} verse au commun` : 'Rien à régler';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line-strong p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Text variant="strong">{name}</Text>
          <Text variant="caption">
            {member.salaryOnCommon ? 'Salaire versé sur le commun' : 'Salaire versé sur son compte'}
          </Text>
        </div>
        {view.settled && <Badge tone="good">Réglé</Badge>}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        <SettlementLines
          name={name}
          groups={view.groups}
          owes={owes}
          carriedOver={view.carriedOver}
          onRemoveAdjustment={setToRemove}
        />
        {payments.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-ink-secondary">
              <Check className="h-3.5 w-3.5 text-positive-bright" aria-hidden />
              Réglé le {formatDateFr(item.date)}
            </span>
            <span className="flex items-center gap-1">
              <Amount cents={item.amount} signed />
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
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
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 self-start text-xs text-ink-subtle-fixed hover:text-ink-emphasis-soft"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Ajouter une dépense payée par {name}
        </button>
        <button
          type="button"
          onClick={() => setAdjusting(true)}
          className="inline-flex items-center gap-1.5 self-start text-xs text-ink-subtle-fixed hover:text-ink-emphasis-soft"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Ajouter un ajustement hors compte
        </button>
      </div>
      {adjusting && <AdjustmentModal member={member} month={month} onClose={() => setAdjusting(false)} />}
      {toRemove?.adjustmentId && (
        <ConfirmDialog
          title="Supprimer cet ajustement ?"
          message={`« ${toRemove.label} » ne comptera plus dans le règlement de ${monthLabel(month)}.`}
          confirmLabel="Supprimer"
          onCancel={() => setToRemove(null)}
          onConfirm={() => {
            view.removeAdjustment(toRemove.adjustmentId!);
            setToRemove(null);
          }}
        />
      )}
      {adding && (
        <TransactionModal
          transaction={null}
          template={null}
          defaultDate={defaultDate}
          title={`Dépense commune payée par ${name}`}
          preset={{ type: 'depense', imputation: `avance:${member.id}`, paymentMethod: 'Carte' }}
          onClose={() => setAdding(false)}
        />
      )}
      {confirming && <LinkTransferModal member={member} month={month} onClose={() => setConfirming(false)} />}
      {toCancel && (
        <ConfirmDialog
          title="Annuler ce règlement ?"
          message="Le virement reste sur le compte commun ; il n’est simplement plus rattaché à ce mois."
          confirmLabel="Annuler le règlement"
          onCancel={() => setToCancel(null)}
          onConfirm={() => {
            view.cancelSettlement(toCancel.id);
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
      subtitle="Revenus arrivés sur le commun − part de chacun − dépenses à sa charge + dépenses avancées ± ajustements"
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
