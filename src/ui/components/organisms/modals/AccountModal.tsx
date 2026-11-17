import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { patrimoineContext } from '@/core/budget/overview';
import { useChartTheme } from '@/hooks/useTheme';
import { useReport } from '@/hooks/useReport';
import { ACCOUNT_KIND_LABELS, MOVEMENT_LABELS } from '@/ui/constants';
import { capitalize, formatDateFr, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Account, IsoDate, MonthKey, SavingsMovementKind } from '@/core/shared/model';
import { accountPosition } from '@/core/patrimoine/patrimoine';
import { accountHistory, accountSeries, type HistoryEntry } from '@/core/patrimoine/accountHistory';
import { useAccountEntry } from '@/hooks/patrimoine/useAccountEntry';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import { Field } from '@/ui/components/molecules/form/Field';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import { ConfirmDialog } from '@/ui/components/molecules/overlays/ConfirmDialog';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Segmented from '@/ui/components/molecules/Segmented';
import Text from '@/ui/components/atoms/Text';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import SavingsAccountForm from './SavingsAccountForm';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';

type AccountModalProps = { account: Account; months: MonthKey[]; endDate: IsoDate; onClose: () => void };

/** Libellé d'une ligne : nature du mouvement, valorisation, ou libellé de l'opération. */
const entryLabel = (entry: HistoryEntry): string => {
  if (entry.kind === 'movement') {
    const { kind, comment } = entry.movement;
    return `${MOVEMENT_LABELS[kind]}${comment ? ` · ${comment}` : ''}`;
  }
  return entry.kind === 'valuation' ? 'Valorisation' : entry.label;
};

const AccountModal = ({ account: initial, months, endDate, onClose }: AccountModalProps) => {
  const dataset = useDataset();
  const account = dataset.accounts.find((item) => item.id === initial.id) ?? initial;
  const [editing, setEditing] = useState(false);
  const finance = useFinanceUseCases();
  const report = useReport();
  const { series, ink } = useChartTheme();
  const form = useAccountEntry(account);
  const [confirm, setConfirm] = useState<HistoryEntry | null>(null);
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const position = accountPosition(account, context, endDate);
  const chart = useMemo(() => accountSeries(account, context, months), [account, context, months]);
  const history = useMemo(() => accountHistory(account, dataset), [account, dataset]);

  const remove = (target: HistoryEntry) => {
    if (target.kind === 'movement') {
      void report(finance.deleteMovement(target.movement), 'Mouvement supprimé');
    }
    if (target.kind === 'valuation') {
      void report(finance.deleteValuation(target.valuation), 'Valorisation supprimée');
    }
  };

  return (
    <Modal title={account.name} onClose={onClose} size="xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Text variant="small">
          {ACCOUNT_KIND_LABELS[account.kind]} · suivi depuis le {formatDateFr(account.openingDate)}
        </Text>
        <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
          Modifier le compte
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Valeur" value={<Amount cents={position.value} />} />
        <Summary label="Versé net" value={<Amount cents={position.contributions} />} />
        <Summary
          label="Intérêts / frais"
          value={
            <>
              <Amount cents={position.interests} /> / <Amount cents={-position.fees} />
            </>
          }
        />
        <Summary label="Performance" value={<Amount cents={position.performance} signed colored />} />
      </div>

      <div className="mt-5 h-56">
        <ResponsiveContainer>
          <LineChart data={chart} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis
              dataKey="month"
              {...axisProps(ink)}
              tickFormatter={(value: string) => monthShortLabel(value)}
            />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={70} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
            <Line
              type="monotone"
              dataKey="valeur"
              name="Valeur"
              stroke={series[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="verse"
              name="Versé net"
              stroke={series[1]}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 rounded-xl border border-line p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Text variant="strong">Ajouter</Text>
          <Segmented
            value={form.formKind}
            onChange={(formKind) => form.change({ formKind })}
            label="Type de saisie"
            options={[
              { value: 'movement', label: 'Mouvement' },
              { value: 'valuation', label: 'Valorisation' },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(date) => form.change({ date })} />
          </Field>
          {form.formKind === 'movement' && (
            <Field label="Nature">
              <Select
                value={form.kind}
                onChange={(value) => form.change({ kind: value as SavingsMovementKind })}
                options={Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
          )}
          <Field label={form.formKind === 'valuation' ? 'Valeur totale du compte (€)' : 'Montant (€)'}>
            <Input
              value={form.amount}
              onChange={(amount) => form.change({ amount })}
              inputMode="decimal"
              placeholder="0,00"
            />
          </Field>
          {form.formKind === 'movement' && (
            <Field label="Commentaire">
              <Input value={form.comment} onChange={(comment) => form.change({ comment })} />
            </Field>
          )}
        </div>
        <Text variant="caption" className="mt-2">
          {form.formKind === 'valuation'
            ? 'Une valorisation fixe la valeur réelle du placement à cette date ; les versements ultérieurs s’y ajoutent.'
            : 'Les virements depuis le compte courant sont déjà comptés comme versements : ne les ressaisis pas ici.'}
        </Text>
        {form.error && <Text className="mt-2 text-negative">{form.error}</Text>}
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={() => void form.save()}>
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <Text variant="label" className="mb-2">
          Historique
        </Text>
        {history.length === 0 ? (
          <Text variant="muted">
            Aucun mouvement depuis l’ouverture le {formatDateFr(account.openingDate)} (solde initial{' '}
            <Amount cents={account.openingBalance} />
            ).
          </Text>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Text className="truncate">{entryLabel(line)}</Text>
                  <Text variant="caption">{formatDateFr(line.date)}</Text>
                </div>
                <div className="flex items-center gap-2">
                  {line.kind === 'valuation' ? (
                    <Badge tone="info">
                      <Amount cents={line.amount} />
                    </Badge>
                  ) : (
                    <Amount cents={line.amount} signed colored />
                  )}
                  {line.kind !== 'transfer' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      label="Supprimer"
                      onClick={() => setConfirm(line)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && (
        <SavingsAccountForm account={account} onClose={() => setEditing(false)} onArchived={onClose} />
      )}
      {confirm && (
        <ConfirmDialog
          title="Supprimer cette ligne ?"
          message={`${entryLabel(confirm)} du ${formatDateFr(confirm.date)} sera supprimé.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            remove(confirm);
            setConfirm(null);
          }}
        />
      )}
    </Modal>
  );
};

type SummaryProps = { label: string; value: React.ReactNode };

const Summary = ({ label, value }: SummaryProps) => (
  <div className="rounded-xl bg-surface-sunken-strong p-3">
    <Text variant="label">{label}</Text>
    <div className="mt-1 text-base font-semibold">{value}</div>
  </div>
);

export default AccountModal;
