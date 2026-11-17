import type { TransactionFilters } from '@/core/comptes/filters';
import type { RuleSuggestion } from '@/core/comptes/learnedRules';
import { DEFAULT_SORT, nextSort, type SortKey, type SortState } from '@/core/comptes/sort';
import type { Transaction } from '@/core/shared/model';

/** Opération en cours de saisie : modifiée (transaction), dupliquée (template) ou nouvelle (aucune). */
export type EditingState = { transaction: Transaction | null; template: Transaction | null };

/** État de la page Opérations pour un compte et une période : critères, sélection et fenêtres ouvertes. */
export type LedgerState = {
  filters: TransactionFilters;
  sort: SortState;
  selection: Set<string>;
  editing: EditingState | null;
  importOpen: boolean;
  /** Opérations à supprimer, en attente de confirmation. */
  pendingDelete: string[] | null;
  ruleToSuggest: RuleSuggestion | null;
};

export type LedgerAction =
  | { type: 'updateFilters'; patch: Partial<TransactionFilters> }
  | { type: 'toggleSort'; key: SortKey }
  | { type: 'toggleSelection'; id: string }
  | { type: 'selectAll'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'edit'; editing: EditingState }
  | { type: 'closeEditing' }
  | { type: 'openImport' }
  | { type: 'closeImport' }
  | { type: 'askDelete'; ids: string[] }
  | { type: 'cancelDelete' }
  | { type: 'deleteConfirmed' }
  | { type: 'suggestRule'; suggestion: RuleSuggestion | null };

export const initialLedgerState = (filters: TransactionFilters): LedgerState => ({
  filters,
  sort: DEFAULT_SORT,
  selection: new Set(),
  editing: null,
  importOpen: false,
  pendingDelete: null,
  ruleToSuggest: null,
});

const toggled = (selection: Set<string>, id: string): Set<string> => {
  const next = new Set(selection);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
};

export const ledgerReducer = (state: LedgerState, action: LedgerAction): LedgerState => {
  switch (action.type) {
    case 'updateFilters':
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case 'toggleSort':
      return { ...state, sort: nextSort(state.sort, action.key) };
    case 'toggleSelection':
      return { ...state, selection: toggled(state.selection, action.id) };
    case 'selectAll':
      return { ...state, selection: new Set(action.ids) };
    case 'clearSelection':
      return { ...state, selection: new Set() };
    case 'edit':
      return { ...state, editing: action.editing };
    case 'closeEditing':
      return { ...state, editing: null };
    case 'openImport':
      return { ...state, importOpen: true };
    case 'closeImport':
      return { ...state, importOpen: false };
    case 'askDelete':
      return { ...state, pendingDelete: action.ids };
    case 'cancelDelete':
      return { ...state, pendingDelete: null };
    case 'deleteConfirmed':
      return { ...state, pendingDelete: null, selection: new Set() };
    case 'suggestRule':
      return { ...state, ruleToSuggest: action.suggestion };
  }
};

/** Lignes affichées et sélectionnées (une opération sortie des filtres n'est pas concernée). */
export const selectedRows = (rows: Transaction[], selection: Set<string>): Transaction[] =>
  rows.filter((row) => selection.has(row.id));

export const allSelected = (rows: Transaction[], selection: Set<string>): boolean =>
  rows.length > 0 && rows.every((row) => selection.has(row.id));
