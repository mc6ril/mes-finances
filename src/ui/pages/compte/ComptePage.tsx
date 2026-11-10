import { memberLabel } from '@/core/commun/household';
import {
  ArrowDownUp,
  CheckCheck,
  Copy,
  Download,
  FileUp,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useDataset, useFileUseCases, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useToast } from '@/hooks/useToast';
import { errorMessage } from '@/ui/errorMessages';
import { useReport } from '@/hooks/useReport';
import {
  cashflowSummary,
  isOutsideAccount,
  livePosition,
  periodPhase,
  signedEffectOn,
} from '@/core/comptes/balances';
import { STATUS_LABELS, TYPE_LABELS } from '@/core/comptes/csvImport';
import { monthEnd, monthStart } from '@/core/shared/dates';
import { formatDateFr, monthLabel } from '@/core/shared/format';
import { parseEuros } from '@/core/shared/money';
import type {
  Account,
  Category,
  Dataset,
  Imputation,
  IsoDate,
  Transaction,
  TransactionStatus,
} from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Badge, { type BadgeTone } from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { cx } from '@/ui/design-system/cx';
import EmptyState from '@/ui/design-system/EmptyState';
import { Checkbox, Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import PageHeader from '@/ui/layout/PageHeader';
import MonthNote, { MonthNoteButton } from '@/ui/common/MonthNote';
import ImportModal from './ImportModal';
import TransactionModal from './TransactionModal';

type SortKey = 'date' | 'label' | 'amount' | 'category';
type SortState = { key: SortKey; direction: 1 | -1 };

type Filters = {
  from: string;
  to: string;
  search: string;
  categoryId: string;
  type: string;
  status: string;
  minAmount: string;
  maxAmount: string;
};

const STATUS_TONE: Record<TransactionStatus, BadgeTone> = {
  prevu: 'info',
  realise: 'neutral',
  rapproche: 'good',
};

const ALL = '';

const matchesAmount = (transaction: Transaction, accountId: string, min: string, max: string): boolean => {
  const value = Math.abs(signedEffectOn(accountId, transaction));
  const minimum = parseEuros(min);
  const maximum = parseEuros(max);
  return (minimum === null || value >= minimum) && (maximum === null || value <= maximum);
};

const normalize = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const applyFilters = (transactions: Transaction[], accountId: string, filters: Filters): Transaction[] => {
  const search = normalize(filters.search.trim());
  return transactions
    .filter(
      (transaction) => transaction.accountId === accountId || transaction.counterpartAccountId === accountId,
    )
    .filter((transaction) => transaction.date >= filters.from && transaction.date <= filters.to)
    .filter(
      (transaction) => !search || normalize(`${transaction.label} ${transaction.comment}`).includes(search),
    )
    .filter(
      (transaction) =>
        filters.categoryId === ALL || (transaction.categoryId ?? 'none') === filters.categoryId,
    )
    .filter((transaction) => filters.type === ALL || transaction.type === filters.type)
    .filter((transaction) => filters.status === ALL || transaction.status === filters.status)
    .filter((transaction) => matchesAmount(transaction, accountId, filters.minAmount, filters.maxAmount));
};

const sortValue = (
  transaction: Transaction,
  key: SortKey,
  accountId: string,
  categoryNames: Map<string, string>,
): string | number => {
  const values: Record<SortKey, () => string | number> = {
    date: () => transaction.date,
    label: () => transaction.label.toLowerCase(),
    amount: () => signedEffectOn(accountId, transaction),
    category: () => categoryNames.get(transaction.categoryId ?? '') ?? '',
  };
  return values[key]();
};

const sortTransactions = (
  transactions: Transaction[],
  sort: SortState,
  accountId: string,
  categoryNames: Map<string, string>,
): Transaction[] =>
  [...transactions].sort((a, b) => {
    const left = sortValue(a, sort.key, accountId, categoryNames);
    const right = sortValue(b, sort.key, accountId, categoryNames);
    if (left === right) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return (left < right ? -1 : 1) * sort.direction;
  });

const nextSort = (current: SortState, key: SortKey): SortState => {
  if (current.key === key) {
    return { key, direction: current.direction === 1 ? -1 : 1 };
  }
  return { key, direction: -1 };
};

type SortHeaderProps = {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
};

const SortHeader = ({ label, sortKey, sort, onSort, align = 'left' }: SortHeaderProps) => (
  <th
    className={align === 'right' ? 'text-right' : ''}
    aria-sort={sort.key === sortKey ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}
  >
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white"
    >
      {label}
      <ArrowDownUp
        className={sort.key === sortKey ? 'h-3 w-3 text-brand-600' : 'h-3 w-3 opacity-40'}
        aria-hidden
      />
    </button>
  </th>
);

type BulkBarProps = {
  selected: Transaction[];
  categories: Category[];
  onClear: () => void;
  onDelete: () => void;
};

const BulkBar = ({ selected, categories, onClear, onDelete }: BulkBarProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [categoryId, setCategoryId] = useState('');
  if (selected.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-500/10">
      <Text variant="strong" as="span">
        {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
      </Text>
      <Button
        size="sm"
        icon={CheckCheck}
        onClick={() =>
          void report(
            finance.updateTransactions(
              selected.map((transaction) => ({ ...transaction, status: 'rapproche' })),
              'Opérations rapprochées',
            ),
            'Opérations rapprochées',
          ).then(onClear)
        }
      >
        Marquer rapprochées
      </Button>
      <div className="flex items-center gap-1">
        <Select
          value={categoryId}
          onChange={setCategoryId}
          label="Catégorie à appliquer"
          className="h-8 w-48 text-xs"
          options={[
            { value: '', label: 'Changer de catégorie…' },
            ...categories
              .filter((category) => !category.archived)
              .map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Button
          size="sm"
          icon={Tag}
          disabled={!categoryId}
          onClick={() =>
            void report(
              finance.updateTransactions(
                selected.map((transaction) => ({ ...transaction, categoryId })),
                'Catégorie mise à jour',
              ),
              'Catégorie mise à jour',
            ).then(onClear)
          }
        >
          Appliquer
        </Button>
      </div>
      <Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>
        Supprimer
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Annuler la sélection
      </Button>
    </div>
  );
};

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

const CurrentPeriodCards = ({ account, transactions, from, to }: Omit<SummaryCardsProps, 'today'>) => {
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
        caption="rapprochés à ce jour"
        valueClassName="text-brand-600 dark:text-brand-300"
      />
      <SummaryCard
        label="À venir"
        value={<Amount cents={position.upcoming} signed colored />}
        caption={
          <>
            réalisé <Amount cents={position.realised} signed /> · prévu{' '}
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

const ClosedPeriodCards = ({
  account,
  transactions,
  from,
  to,
  projected,
}: Omit<SummaryCardsProps, 'today'> & { projected: boolean }) => {
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

type EditingState = { transaction: Transaction | null; template: Transaction | null };

type LedgerProps = { dataset: Dataset; account: Account; initialFilters: Filters };

const Ledger = ({ dataset, account, initialFilters }: LedgerProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const files = useFileUseCases();
  const { notify } = useToast();
  const { today } = usePeriod();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: -1 });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const categoryNames = useMemo(
    () => new Map(dataset.categories.map((category) => [category.id, category.name])),
    [dataset.categories],
  );
  const accountNames = useMemo(
    () => new Map(dataset.accounts.map((item) => [item.id, item.name])),
    [dataset.accounts],
  );
  const rows = useMemo(
    () =>
      sortTransactions(
        applyFilters(dataset.transactions, account.id, filters),
        sort,
        account.id,
        categoryNames,
      ),
    [dataset.transactions, account.id, filters, sort, categoryNames],
  );
  const selected = rows.filter((row) => selection.has(row.id));
  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const toggleSort = (key: SortKey) => setSort((current) => nextSort(current, key));
  const toggle = (id: string) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((row) => selection.has(row.id));

  const exportCsv = () => {
    const saved = files.exportOperationsCsv({
      fileLabel: account.name,
      period: `${filters.from}_${filters.to}`,
      transactions: rows,
      categories: dataset.categories,
      accounts: dataset.accounts,
    });
    if (!saved.ok) {
      notify(errorMessage(saved.error), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SummaryCards
        account={account}
        transactions={dataset.transactions}
        from={filters.from}
        to={filters.to}
        today={today}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden
              />
              <Input
                type="search"
                value={filters.search}
                onChange={(search) => update({ search })}
                placeholder="Rechercher un libellé…"
                className="pl-9"
                label="Recherche"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={FileUp} onClick={() => setImportOpen(true)}>
                Importer CSV
              </Button>
              <Button icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
                Exporter CSV
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setEditing({ transaction: null, template: null })}
              >
                Nouvelle opération
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <Input type="date" value={filters.from} onChange={(from) => update({ from })} label="Du" />
            <Input type="date" value={filters.to} onChange={(to) => update({ to })} label="Au" />
            <Select
              value={filters.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              label="Catégorie"
              options={[
                { value: ALL, label: 'Toutes catégories' },
                { value: 'none', label: 'Sans catégorie' },
                ...dataset.categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
            <Select
              value={filters.type}
              onChange={(type) => update({ type })}
              label="Type"
              options={[
                { value: ALL, label: 'Tous types' },
                ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Select
              value={filters.status}
              onChange={(status) => update({ status })}
              label="Statut"
              options={[
                { value: ALL, label: 'Tous statuts' },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Input
              value={filters.minAmount}
              onChange={(minAmount) => update({ minAmount })}
              placeholder="Montant min."
              inputMode="decimal"
              label="Montant minimum"
            />
            <Input
              value={filters.maxAmount}
              onChange={(maxAmount) => update({ maxAmount })}
              placeholder="Montant max."
              inputMode="decimal"
              label="Montant maximum"
            />
          </div>
          <BulkBar
            selected={selected}
            categories={dataset.categories}
            onClear={() => setSelection(new Set())}
            onDelete={() => setPendingDelete(selected.map((row) => row.id))}
          />
        </div>

        {rows.length === 0 ? (
          <div className="px-4 pb-5 sm:px-5">
            <EmptyState
              icon={Wallet}
              title="Aucune opération sur cette période"
              description="Ajoute une opération manuellement ou importe le relevé CSV de ta banque."
              action={
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setEditing({ transaction: null, template: null })}
                >
                  Ajouter une opération
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={allSelected}
                      label="Tout sélectionner"
                      onChange={(checked) =>
                        setSelection(checked ? new Set(rows.map((row) => row.id)) : new Set())
                      }
                    />
                  </th>
                  <SortHeader label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Libellé" sortKey="label" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Catégorie" sortKey="category" sort={sort} onSort={toggleSort} />
                  <th>Type</th>
                  <th>Statut</th>
                  <SortHeader
                    label="Montant"
                    sortKey="amount"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  />
                  <th className="w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.status === 'prevu' ? 'opacity-70' : ''}>
                    <td>
                      <Checkbox
                        checked={selection.has(row.id)}
                        label={`Sélectionner ${row.label}`}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{formatDateFr(row.date)}</td>
                    <td className="max-w-[260px]">
                      <Text className="truncate font-medium" title={row.label}>
                        {row.label}
                      </Text>
                      <TransferHint transaction={row} accountId={account.id} accountNames={accountNames} />
                      <ImputationHint transaction={row} dataset={dataset} />
                    </td>
                    <td>
                      {categoryNames.get(row.categoryId ?? '') ?? (
                        <Text as="span" variant="caption">
                          Sans catégorie
                        </Text>
                      )}
                    </td>
                    <td>
                      <Text as="span" variant="small">
                        {row.type === 'depense' && row.amount > 0 ? 'Remboursement' : TYPE_LABELS[row.type]}
                      </Text>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                    </td>
                    <td className="text-right font-medium">
                      {isOutsideAccount(row) ? (
                        <span title="Hors du compte : ne change pas le solde">
                          <Amount cents={row.amount} className="text-stone-400" />
                        </span>
                      ) : (
                        <Amount cents={signedEffectOn(account.id, row)} colored />
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          label="Modifier"
                          onClick={() => setEditing({ transaction: row, template: null })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          label="Dupliquer"
                          onClick={() => setEditing({ transaction: null, template: row })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          label="Supprimer"
                          onClick={() => setPendingDelete([row.id])}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <TransactionModal
          transaction={editing.transaction}
          template={editing.template}
          defaultDate={filters.to}
          onClose={() => setEditing(null)}
        />
      )}
      {importOpen && <ImportModal accountId={account.id} onClose={() => setImportOpen(false)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Supprimer ?"
          message={`${pendingDelete.length} opération${pendingDelete.length > 1 ? 's seront supprimées' : ' sera supprimée'} définitivement. Pense à exporter une sauvegarde si tu as un doute.`}
          confirmLabel="Supprimer"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void report(
              finance.deleteTransactions(pendingDelete),
              `${pendingDelete.length} opération${pendingDelete.length > 1 ? 's supprimées' : ' supprimée'}`,
            );
            setSelection(new Set());
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
};

type ImputationHintProps = { transaction: Transaction; dataset: Dataset };

const IMPUTATION_HINTS: Record<Imputation['kind'], (name: string, outside: boolean) => string> = {
  charge: (name, outside) =>
    outside ? `à la charge de ${name}, réglé hors compte` : `à la charge de ${name}`,
  avance: (name) => `avancé par ${name}`,
  revenu: (name, outside) => (outside ? `revenu de ${name}, versé sur son compte` : `revenu de ${name}`),
};

const ImputationHint = ({ transaction, dataset }: ImputationHintProps) => {
  if (!transaction.imputation) {
    return null;
  }
  const name = memberLabel(dataset, transaction.imputation.memberId);
  return (
    <Text variant="caption" className="text-amber-700 dark:text-amber-400">
      {transaction.imputation.kind === 'charge' && transaction.amount > 0
        ? `reçu pour ${name}`
        : IMPUTATION_HINTS[transaction.imputation.kind](name, transaction.imputation.outside === true)}
    </Text>
  );
};

type TransferHintProps = { transaction: Transaction; accountId: string; accountNames: Map<string, string> };

const TransferHint = ({ transaction, accountId, accountNames }: TransferHintProps) => {
  if (!transaction.counterpartAccountId) {
    return null;
  }
  if (transaction.counterpartAccountId === accountId) {
    return <Text variant="caption">depuis {accountNames.get(transaction.accountId)}</Text>;
  }
  return <Text variant="caption">vers {accountNames.get(transaction.counterpartAccountId)}</Text>;
};

const ComptePage = () => {
  const dataset = useDataset();
  const { month } = usePeriod();
  const [accountId, setAccountId] = useState(dataset.settings.mainAccountId);
  const [noteMonth, setNoteMonth] = useState<string | null>(null);
  const account = dataset.accounts.find((item) => item.id === accountId) ?? dataset.accounts[0];
  if (!account) {
    return (
      <EmptyState icon={Wallet} title="Aucun compte" description="Crée un compte dans les paramètres." />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Compte courant"
        description={`Opérations de ${monthLabel(month)} · suivi depuis le ${formatDateFr(account.openingDate)}`}
        actions={
          <>
            <MonthNoteButton month={month} onClick={() => setNoteMonth(month)} />
            <div className="w-56">
              <Select
                value={account.id}
                onChange={setAccountId}
                label="Compte affiché"
                options={dataset.accounts
                  .filter((item) => !item.archived)
                  .map((item) => ({ value: item.id, label: item.name }))}
              />
            </div>
          </>
        }
      />
      <MonthNote
        key={`${month}-${noteMonth === month}`}
        month={month}
        editing={noteMonth === month}
        onEditingChange={(editing) => setNoteMonth(editing ? month : null)}
      />
      <Ledger
        key={`${account.id}-${month}`}
        dataset={dataset}
        account={account}
        initialFilters={{
          from: monthStart(month),
          to: monthEnd(month),
          search: '',
          categoryId: ALL,
          type: ALL,
          status: ALL,
          minAmount: '',
          maxAmount: '',
        }}
      />
    </div>
  );
};

export default ComptePage;
