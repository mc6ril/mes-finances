import { CheckCheck } from 'lucide-react';
import { memo } from 'react';
import { memberLabel } from '@/core/commun/household';
import { isVerified } from '@/core/comptes/balances';
import { statusLabel } from '@/core/comptes/csvImport';
import { imputationHint, transferHint } from '@/core/comptes/hints';
import { formatDateFr } from '@/core/shared/format';
import type { Dataset, Transaction } from '@/core/shared/model';
import Badge from '@/ui/components/atoms/Badge';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { RowAmount, statusTone } from './LedgerCells';

type LedgerItemProps = {
  row: Transaction;
  accountId: string;
  categoryName: string | undefined;
  hint: string | null;
  imputation: string | null;
  selected: boolean;
  onToggle: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
};

/** Une opération sur deux lignes : libellé et montant, puis date et catégorie. Toucher ouvre la saisie. */
const LedgerItem = memo(
  ({ row, accountId, categoryName, hint, imputation, selected, onToggle, onEdit }: LedgerItemProps) => (
    <li
      className={
        row.status === 'prevu' ? 'flex items-start gap-3 py-3 opacity-70' : 'flex items-start gap-3 py-3'
      }
    >
      <div className="pt-0.5">
        <Checkbox checked={selected} label={`Sélectionner ${row.label}`} onChange={() => onToggle(row.id)} />
      </div>
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-ink-emphasis">{row.label}</span>
          <span className="shrink-0 text-sm font-medium">
            <RowAmount row={row} accountId={accountId} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <span className="tabular-nums">{formatDateFr(row.date)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{categoryName ?? 'Sans catégorie'}</span>
          {row.status === 'prevu' && (
            <Badge tone={statusTone(row)} className="ml-auto">
              {statusLabel(row)}
            </Badge>
          )}
          {isVerified(row) && (
            <CheckCheck className="ml-auto h-3.5 w-3.5 shrink-0 text-positive" aria-label="Vérifiée" />
          )}
        </span>
        {hint !== null && <span className="truncate text-xs text-ink-faint">{hint}</span>}
        {imputation !== null && (
          <span className="truncate text-xs text-warning-ink-strong">{imputation}</span>
        )}
      </button>
    </li>
  ),
);

type LedgerListProps = {
  rows: Transaction[];
  dataset: Dataset;
  accountId: string;
  categoryNames: Map<string, string>;
  accountNames: Map<string, string>;
  selection: Set<string>;
  allSelected: boolean;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onToggle: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
};

/** Liste des opérations sur téléphone, à la place du tableau trop large. */
const LedgerList = ({
  rows,
  dataset,
  accountId,
  categoryNames,
  accountNames,
  selection,
  allSelected,
  onSelectAll,
  onClearSelection,
  onToggle,
  onEdit,
}: LedgerListProps) => (
  <div className="px-4">
    <div className="border-y border-line-strong py-2">
      <Checkbox
        checked={allSelected}
        label="Tout sélectionner"
        onChange={(checked) => (checked ? onSelectAll(rows.map((row) => row.id)) : onClearSelection())}
      >
        <span className="text-xs text-ink-subtle">
          {rows.length} opération{rows.length > 1 ? 's' : ''}
        </span>
      </Checkbox>
    </div>
    <ul className="divide-y divide-line-soft">
      {rows.map((row) => (
        <LedgerItem
          key={row.id}
          row={row}
          accountId={accountId}
          categoryName={categoryNames.get(row.categoryId ?? '')}
          hint={transferHint(row, accountId, accountNames)}
          imputation={
            row.imputation ? imputationHint(row, memberLabel(dataset, row.imputation.memberId)) : null
          }
          selected={selection.has(row.id)}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}
    </ul>
  </div>
);

export default LedgerList;
