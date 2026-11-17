import { useCallback, useMemo, useReducer } from 'react';
import { filterTransactions, type TransactionFilters } from '@/core/comptes/filters';
import { firstRuleSuggestion } from '@/core/comptes/learnedRules';
import { sortTransactions, type SortKey } from '@/core/comptes/sort';
import type { Account, Dataset, Transaction } from '@/core/shared/model';
import {
  allSelected,
  initialLedgerState,
  ledgerReducer,
  selectedRows,
  type EditingState,
} from './ledgerState';

export type CategoryChange = { before: Transaction; after: Transaction };

/** Actions du grand livre : stables d'un rendu à l'autre (les lignes mémoïsées ne se redessinent pas). */
export type LedgerActions = {
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  toggleSort: (key: SortKey) => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  edit: (editing: EditingState) => void;
  create: () => void;
  modify: (transaction: Transaction) => void;
  duplicate: (template: Transaction) => void;
  closeEditing: () => void;
  openImport: () => void;
  closeImport: () => void;
  askDelete: (ids: string[]) => void;
  askDeleteOne: (id: string) => void;
  cancelDelete: () => void;
  deleteConfirmed: () => void;
  dismissRule: () => void;
};

type UseLedgerInput = { dataset: Dataset; account: Account; initialFilters: TransactionFilters };

/** État et lignes de la page Opérations d'un compte : la logique vit dans core et ledgerState. */
export const useLedger = ({ dataset, account, initialFilters }: UseLedgerInput) => {
  const [state, dispatch] = useReducer(ledgerReducer, initialFilters, initialLedgerState);

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
        filterTransactions(dataset.transactions, account.id, state.filters),
        state.sort,
        account.id,
        categoryNames,
      ),
    [dataset.transactions, account.id, state.filters, state.sort, categoryNames],
  );
  const selected = useMemo(() => selectedRows(rows, state.selection), [rows, state.selection]);

  const actions = useMemo<LedgerActions>(
    () => ({
      updateFilters: (patch) => dispatch({ type: 'updateFilters', patch }),
      toggleSort: (key) => dispatch({ type: 'toggleSort', key }),
      toggleSelection: (id) => dispatch({ type: 'toggleSelection', id }),
      selectAll: (ids) => dispatch({ type: 'selectAll', ids }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      edit: (editing) => dispatch({ type: 'edit', editing }),
      create: () => dispatch({ type: 'edit', editing: { transaction: null, template: null } }),
      modify: (transaction) => dispatch({ type: 'edit', editing: { transaction, template: null } }),
      duplicate: (template) => dispatch({ type: 'edit', editing: { transaction: null, template } }),
      closeEditing: () => dispatch({ type: 'closeEditing' }),
      openImport: () => dispatch({ type: 'openImport' }),
      closeImport: () => dispatch({ type: 'closeImport' }),
      askDelete: (ids) => dispatch({ type: 'askDelete', ids }),
      askDeleteOne: (id) => dispatch({ type: 'askDelete', ids: [id] }),
      cancelDelete: () => dispatch({ type: 'cancelDelete' }),
      deleteConfirmed: () => dispatch({ type: 'deleteConfirmed' }),
      dismissRule: () => dispatch({ type: 'suggestRule', suggestion: null }),
    }),
    [],
  );

  const importRules = dataset.settings.importRules;
  /** Après un changement de catégorie : propose « toujours classer … » si aucune règle ne le couvre. */
  const suggestRule = useCallback(
    (changes: CategoryChange[]) =>
      dispatch({ type: 'suggestRule', suggestion: firstRuleSuggestion(changes, importRules ?? []) }),
    [importRules],
  );

  return {
    state,
    rows,
    selected,
    allSelected: allSelected(rows, state.selection),
    categoryNames,
    accountNames,
    actions,
    suggestRule,
  };
};
