import { Plus, Wallet } from 'lucide-react';
import type { TransactionFilters } from '@/core/comptes/filters';
import type { Account, Dataset } from '@/core/shared/model';
import { useFileUseCases, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { useToast } from '@/hooks/useToast';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';
import { ConfirmDialog } from '@/ui/components/molecules/overlays/ConfirmDialog';
import { errorMessage } from '@/ui/errorMessages';
import BulkBar from './BulkBar';
import ImportModal from '@/ui/components/organisms/modals/ImportModal';
import LedgerFilters from './LedgerFilters';
import LedgerTable from './LedgerTable';
import LedgerToolbar from './LedgerToolbar';
import RuleSuggestionBanner from './RuleSuggestionBanner';
import SummaryCards from './SummaryCards';
import TransactionModal from '@/ui/components/organisms/modals/TransactionModal';
import { useLedger } from '@/hooks/compte/useLedger';

type LedgerProps = { dataset: Dataset; account: Account; initialFilters: TransactionFilters };

/** Opérations d'un compte sur une période : soldes, filtres, liste et fenêtres de saisie. */
const Ledger = ({ dataset, account, initialFilters }: LedgerProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const files = useFileUseCases();
  const { notify } = useToast();
  const { today } = usePeriod();
  const { state, rows, selected, allSelected, categoryNames, accountNames, actions, suggestRule } = useLedger(
    {
      dataset,
      account,
      initialFilters,
    },
  );
  const { filters, sort, selection, editing, importOpen, pendingDelete, ruleToSuggest } = state;

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

      {ruleToSuggest && <RuleSuggestionBanner suggestion={ruleToSuggest} onDone={actions.dismissRule} />}

      <Card padded={false}>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <LedgerToolbar
            search={filters.search}
            onSearch={(search) => actions.updateFilters({ search })}
            onImport={actions.openImport}
            onExport={exportCsv}
            canExport={rows.length > 0}
            onCreate={actions.create}
          />
          <LedgerFilters filters={filters} categories={dataset.categories} onChange={actions.updateFilters} />
          <BulkBar
            selected={selected}
            categories={dataset.categories}
            onClear={actions.clearSelection}
            onDelete={() => actions.askDelete(selected.map((row) => row.id))}
            onRecategorized={suggestRule}
          />
        </div>

        {rows.length === 0 ? (
          <div className="px-4 pb-5 sm:px-5">
            <EmptyState
              icon={Wallet}
              title="Aucune opération sur cette période"
              description="Ajoute une opération manuellement ou importe le relevé CSV de ta banque."
              action={
                <Button variant="primary" icon={Plus} onClick={actions.create}>
                  Ajouter une opération
                </Button>
              }
            />
          </div>
        ) : (
          <LedgerTable
            rows={rows}
            dataset={dataset}
            accountId={account.id}
            categoryNames={categoryNames}
            accountNames={accountNames}
            sort={sort}
            onSort={actions.toggleSort}
            selection={selection}
            allSelected={allSelected}
            onSelectAll={actions.selectAll}
            onClearSelection={actions.clearSelection}
            onToggle={actions.toggleSelection}
            onEdit={actions.modify}
            onDuplicate={actions.duplicate}
            onDelete={actions.askDeleteOne}
          />
        )}
      </Card>

      {editing && (
        <TransactionModal
          transaction={editing.transaction}
          template={editing.template}
          defaultDate={filters.to}
          onClose={actions.closeEditing}
          onSaved={(before, after) => suggestRule([{ before, after }])}
        />
      )}
      {importOpen && <ImportModal accountId={account.id} onClose={actions.closeImport} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Supprimer ?"
          message={`${pendingDelete.length} opération${pendingDelete.length > 1 ? 's seront supprimées' : ' sera supprimée'} définitivement. Pense à exporter une sauvegarde si tu as un doute.`}
          confirmLabel="Supprimer"
          onCancel={actions.cancelDelete}
          onConfirm={() => {
            void report(
              finance.deleteTransactions(pendingDelete),
              `${pendingDelete.length} opération${pendingDelete.length > 1 ? 's supprimées' : ' supprimée'}`,
            );
            actions.deleteConfirmed();
          }}
        />
      )}
    </div>
  );
};

export default Ledger;
