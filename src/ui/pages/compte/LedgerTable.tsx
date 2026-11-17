import { ArrowDownUp, Copy, Pencil, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { memberLabel } from '@/core/commun/household';
import { isOutsideAccount, isVerified, signedEffectOn } from '@/core/comptes/balances';
import { statusLabel, TYPE_LABELS } from '@/core/comptes/csvImport';
import { imputationHint, transferHint } from '@/core/comptes/hints';
import type { SortKey, SortState } from '@/core/comptes/sort';
import { formatDateFr } from '@/core/shared/format';
import type { Dataset, Transaction } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Badge, { type BadgeTone } from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import { Checkbox } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';
import { MUTED_TEXT } from '@/ui/design-system/textColors';

const statusTone = (transaction: Transaction): BadgeTone => {
  if (transaction.status === 'prevu') {
    return 'info';
  }
  return isVerified(transaction) ? 'good' : 'neutral';
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

type LedgerRowProps = {
  row: Transaction;
  accountId: string;
  categoryName: string | undefined;
  transfer: string | null;
  imputation: string | null;
  selected: boolean;
  onToggle: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (template: Transaction) => void;
  onDelete: (id: string) => void;
};

/** Une opération ; mémoïsée : seules les lignes modifiées ou (dé)sélectionnées se redessinent. */
const LedgerRow = memo(
  ({
    row,
    accountId,
    categoryName,
    transfer,
    imputation,
    selected,
    onToggle,
    onEdit,
    onDuplicate,
    onDelete,
  }: LedgerRowProps) => (
    <tr className={row.status === 'prevu' ? 'opacity-70' : ''}>
      <td>
        <Checkbox checked={selected} label={`Sélectionner ${row.label}`} onChange={() => onToggle(row.id)} />
      </td>
      <td className="whitespace-nowrap tabular-nums">{formatDateFr(row.date)}</td>
      <td className="max-w-[260px]">
        <Text className="truncate font-medium" title={row.label}>
          {row.label}
        </Text>
        {transfer !== null && <Text variant="caption">{transfer}</Text>}
        {imputation !== null && (
          <Text variant="caption" className="text-amber-700 dark:text-amber-400">
            {imputation}
          </Text>
        )}
      </td>
      <td>
        {categoryName ?? (
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
        <Badge tone={statusTone(row)}>{statusLabel(row)}</Badge>
      </td>
      <td className="text-right font-medium">
        {isOutsideAccount(row) ? (
          <span title="Hors du compte : ne change pas le solde">
            <Amount cents={row.amount} className={MUTED_TEXT} />
          </span>
        ) : (
          <Amount cents={signedEffectOn(accountId, row)} colored />
        )}
      </td>
      <td>
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" icon={Pencil} label="Modifier" onClick={() => onEdit(row)} />
          <Button variant="ghost" size="sm" icon={Copy} label="Dupliquer" onClick={() => onDuplicate(row)} />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            label="Supprimer"
            onClick={() => onDelete(row.id)}
          />
        </div>
      </td>
    </tr>
  ),
);

type LedgerTableProps = {
  rows: Transaction[];
  dataset: Dataset;
  accountId: string;
  categoryNames: Map<string, string>;
  accountNames: Map<string, string>;
  sort: SortState;
  onSort: (key: SortKey) => void;
  selection: Set<string>;
  allSelected: boolean;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onToggle: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (template: Transaction) => void;
  onDelete: (id: string) => void;
};

const LedgerTable = ({
  rows,
  dataset,
  accountId,
  categoryNames,
  accountNames,
  sort,
  onSort,
  selection,
  allSelected,
  onSelectAll,
  onClearSelection,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: LedgerTableProps) => (
  <div className="overflow-x-auto">
    <table className="table-base min-w-[860px]">
      <thead>
        <tr>
          <th className="w-10">
            <Checkbox
              checked={allSelected}
              label="Tout sélectionner"
              onChange={(checked) => (checked ? onSelectAll(rows.map((row) => row.id)) : onClearSelection())}
            />
          </th>
          <SortHeader label="Date" sortKey="date" sort={sort} onSort={onSort} />
          <SortHeader label="Libellé" sortKey="label" sort={sort} onSort={onSort} />
          <SortHeader label="Catégorie" sortKey="category" sort={sort} onSort={onSort} />
          <th>Type</th>
          <th>Statut</th>
          <SortHeader label="Montant" sortKey="amount" sort={sort} onSort={onSort} align="right" />
          <th className="w-28 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <LedgerRow
            key={row.id}
            row={row}
            accountId={accountId}
            categoryName={categoryNames.get(row.categoryId ?? '')}
            transfer={transferHint(row, accountId, accountNames)}
            imputation={
              row.imputation ? imputationHint(row, memberLabel(dataset, row.imputation.memberId)) : null
            }
            selected={selection.has(row.id)}
            onToggle={onToggle}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </table>
  </div>
);

export default LedgerTable;
