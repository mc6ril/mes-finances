import { FileUp, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { patrimoineContext } from '@/core/budget/overview';
import { useChartTheme } from '@/hooks/useTheme';
import { useReport } from '@/hooks/useReport';
import { MOVEMENT_LABELS } from '@/ui/constants';
import { isCounted, isInternalMove } from '@/core/comptes/balances';
import { monthEnd, parseFlexibleDate } from '@/core/shared/dates';
import { capitalize, formatDateFr, monthLabel, monthShortLabel } from '@/core/shared/format';
import { parseEuros } from '@/core/shared/money';
import type { Account, Cents, IsoDate, MonthKey, SavingsMovementKind } from '@/core/shared/model';
import { accountPosition } from '@/core/patrimoine/patrimoine';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import { Field, Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog, Modal } from '@/ui/design-system/Modal';
import Segmented from '@/ui/design-system/Segmented';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import BrokerImportModal from './BrokerImportModal';
import { axisProps, euroTick } from '@/ui/charts/axis';

const MOVEMENT_SIGN: Record<SavingsMovementKind, 1 | -1> = {
  versement: 1,
  interets: 1,
  retrait: -1,
  frais: -1,
};

type HistoryEntry = {
  id: string;
  date: IsoDate;
  label: string;
  amount: Cents;
  kind: 'movement' | 'valuation' | 'transfer';
  onDelete: (() => void) | null;
};

type AccountModalProps = { account: Account; months: MonthKey[]; endDate: IsoDate; onClose: () => void };

type FormKind = 'movement' | 'valuation';

const AccountModal = ({ account: initial, months, endDate, onClose }: AccountModalProps) => {
  const dataset = useDataset();
  const account = dataset.accounts.find((item) => item.id === initial.id) ?? initial;
  const [importOpen, setImportOpen] = useState(false);
  const { today } = usePeriod();
  const finance = useFinanceUseCases();
  const report = useReport();
  const { series, ink } = useChartTheme();
  const [formKind, setFormKind] = useState<FormKind>(
    account.group === 'investissement' ? 'valuation' : 'movement',
  );
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<SavingsMovementKind>('versement');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HistoryEntry | null>(null);
  const context = patrimoineContext(dataset);
  const position = accountPosition(account, context, endDate);
  const chart = useMemo(
    () =>
      months.map((month) => ({
        month,
        valeur: accountPosition(account, context, monthEnd(month)).value,
        verse: accountPosition(account, context, monthEnd(month)).contributions,
      })),
    [account, context, months],
  );

  const history: HistoryEntry[] = [
    ...dataset.savingsMovements
      .filter((movement) => movement.accountId === account.id)
      .map((movement) => ({
        id: movement.id,
        date: movement.date,
        label: `${MOVEMENT_LABELS[movement.kind]}${movement.comment ? ` · ${movement.comment}` : ''}`,
        amount: MOVEMENT_SIGN[movement.kind] * movement.amount,
        kind: 'movement' as const,
        onDelete: () => void report(finance.deleteMovement(movement), 'Mouvement supprimé'),
      })),
    ...dataset.valuations
      .filter((valuation) => valuation.accountId === account.id)
      .map((valuation) => ({
        id: valuation.id,
        date: valuation.date,
        label: 'Valorisation',
        amount: valuation.value,
        kind: 'valuation' as const,
        onDelete: () => void report(finance.deleteValuation(valuation), 'Valorisation supprimée'),
      })),
    ...dataset.transactions
      .filter(
        (transaction) =>
          isCounted(transaction) &&
          isInternalMove(transaction) &&
          transaction.counterpartAccountId === account.id,
      )
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        label: `${transaction.label} (depuis le compte courant)`,
        amount: -transaction.amount,
        kind: 'transfer' as const,
        onDelete: null,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const save = async () => {
    const parsedDate = parseFlexibleDate(date);
    const cents = parseEuros(amount);
    if (!parsedDate || cents === null || cents < 0) {
      setError('Renseigne une date et un montant positif.');
      return;
    }
    setError(null);
    const saveEntry = {
      valuation: () =>
        report(
          finance.saveValuation({ accountId: account.id, date: parsedDate, value: cents }),
          'Valorisation enregistrée',
        ),
      movement: () =>
        report(
          finance.saveMovement({
            accountId: account.id,
            date: parsedDate,
            kind,
            amount: cents,
            comment: comment.trim(),
          }),
          'Mouvement enregistré',
        ),
    };
    if (await saveEntry[formKind]()) {
      setAmount('');
      setComment('');
    }
  };

  return (
    <Modal title={account.name} onClose={onClose} size="xl">
      {account.group === 'investissement' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
          <Text variant="small">
            Importe l’export CSV de tes transactions Trade Republic : versements, dividendes et frais sont
            ajoutés automatiquement.
          </Text>
          <Button size="sm" icon={FileUp} onClick={() => setImportOpen(true)}>
            Importer un export Trade Republic
          </Button>
        </div>
      )}
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

      <div className="mt-5 rounded-xl border border-stone-100 p-4 dark:border-stone-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Text variant="strong">Ajouter</Text>
          <Segmented
            value={formKind}
            onChange={setFormKind}
            label="Type de saisie"
            options={[
              { value: 'movement', label: 'Mouvement' },
              { value: 'valuation', label: 'Valorisation' },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date">
            <Input type="date" value={date} onChange={setDate} />
          </Field>
          {formKind === 'movement' && (
            <Field label="Nature">
              <Select
                value={kind}
                onChange={(value) => setKind(value as SavingsMovementKind)}
                options={Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
          )}
          <Field label={formKind === 'valuation' ? 'Valeur totale du compte (€)' : 'Montant (€)'}>
            <Input value={amount} onChange={setAmount} inputMode="decimal" placeholder="0,00" />
          </Field>
          {formKind === 'movement' && (
            <Field label="Commentaire">
              <Input value={comment} onChange={setComment} />
            </Field>
          )}
        </div>
        <Text variant="caption" className="mt-2">
          {formKind === 'valuation'
            ? 'Une valorisation fixe la valeur réelle du placement à cette date ; les versements ultérieurs s’y ajoutent.'
            : 'Les virements depuis le compte courant sont déjà comptés comme versements : ne les ressaisis pas ici.'}
        </Text>
        {error && <Text className="mt-2 text-red-600 dark:text-red-400">{error}</Text>}
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={() => void save()}>
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
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Text className="truncate">{entry.label}</Text>
                  <Text variant="caption">{formatDateFr(entry.date)}</Text>
                </div>
                <div className="flex items-center gap-2">
                  {entry.kind === 'valuation' ? (
                    <Badge tone="info">
                      <Amount cents={entry.amount} />
                    </Badge>
                  ) : (
                    <Amount cents={entry.amount} signed colored />
                  )}
                  {entry.onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      label="Supprimer"
                      onClick={() => setConfirm(entry)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {importOpen && <BrokerImportModal account={account} onClose={() => setImportOpen(false)} />}
      {confirm && (
        <ConfirmDialog
          title="Supprimer cette ligne ?"
          message={`${confirm.label} du ${formatDateFr(confirm.date)} sera supprimé.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.onDelete?.();
            setConfirm(null);
          }}
        />
      )}
    </Modal>
  );
};

type SummaryProps = { label: string; value: React.ReactNode };

const Summary = ({ label, value }: SummaryProps) => (
  <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
    <Text variant="label">{label}</Text>
    <div className="mt-1 text-base font-semibold">{value}</div>
  </div>
);

export default AccountModal;
