import { ALL, type TransactionFilters } from '@/core/comptes/filters';
import { DEFAULT_SORT } from '@/core/comptes/sort';
import {
  allSelected,
  initialLedgerState,
  type LedgerState,
  ledgerReducer,
  selectedRows,
} from '@/hooks/compte/ledgerState';
import { aTransaction } from '../../core/fixtures';

const filters: TransactionFilters = {
  from: '2026-03-01',
  to: '2026-03-31',
  search: '',
  categoryId: ALL,
  type: ALL,
  status: ALL,
  minAmount: '',
  maxAmount: '',
};

const start = (): LedgerState => initialLedgerState(filters);

const withSelection = (...ids: string[]): LedgerState => ({ ...start(), selection: new Set(ids) });

describe('état initial du grand livre', () => {
  it('part des filtres reçus, trié par date décroissante, sans sélection ni fenêtre ouverte', () => {
    expect(start()).toEqual({
      filters,
      sort: DEFAULT_SORT,
      selection: new Set(),
      editing: null,
      importOpen: false,
      pendingDelete: null,
      ruleToSuggest: null,
    });
  });
});

describe('filtres et tri', () => {
  it('fusionne une modification des filtres sans toucher aux autres critères', () => {
    const next = ledgerReducer(start(), {
      type: 'updateFilters',
      patch: { search: 'loyer', minAmount: '10' },
    });
    expect(next.filters).toEqual({ ...filters, search: 'loyer', minAmount: '10' });
  });

  it('inverse le sens ou change de colonne', () => {
    const reversed = ledgerReducer(start(), { type: 'toggleSort', key: 'date' });
    expect(reversed.sort).toEqual({ key: 'date', direction: 1 });
    expect(ledgerReducer(reversed, { type: 'toggleSort', key: 'label' }).sort).toEqual({
      key: 'label',
      direction: -1,
    });
  });
});

describe('sélection', () => {
  it('coche puis décoche une opération sans modifier l’état précédent', () => {
    const before = start();
    const checked = ledgerReducer(before, { type: 'toggleSelection', id: 'a' });
    expect(checked.selection).toEqual(new Set(['a']));
    expect(before.selection).toEqual(new Set());
    expect(ledgerReducer(checked, { type: 'toggleSelection', id: 'a' }).selection).toEqual(new Set());
  });

  it('sélectionne toutes les lignes affichées, ou vide la sélection', () => {
    const all = ledgerReducer(withSelection('x'), { type: 'selectAll', ids: ['a', 'b'] });
    expect(all.selection).toEqual(new Set(['a', 'b']));
    expect(ledgerReducer(all, { type: 'clearSelection' }).selection).toEqual(new Set());
  });

  it('ne retient que les lignes affichées et sélectionnées', () => {
    const rows = [aTransaction({ id: 'a' }), aTransaction({ id: 'b' })];
    const state = withSelection('b', 'hors-filtre');
    expect(selectedRows(rows, state.selection).map((row) => row.id)).toEqual(['b']);
  });

  it('considère tout sélectionné seulement si chaque ligne affichée l’est', () => {
    const rows = [aTransaction({ id: 'a' }), aTransaction({ id: 'b' })];
    expect(allSelected(rows, new Set(['a', 'b', 'c']))).toBe(true);
    expect(allSelected(rows, new Set(['a']))).toBe(false);
    expect(allSelected([], new Set())).toBe(false);
  });
});

describe('fenêtres', () => {
  it('ouvre et ferme la saisie d’une opération (nouvelle, modifiée ou dupliquée)', () => {
    const row = aTransaction();
    const editing = ledgerReducer(start(), { type: 'edit', editing: { transaction: row, template: null } });
    expect(editing.editing).toEqual({ transaction: row, template: null });
    expect(ledgerReducer(editing, { type: 'closeEditing' }).editing).toBeNull();
  });

  it('ouvre et ferme l’import', () => {
    const open = ledgerReducer(start(), { type: 'openImport' });
    expect(open.importOpen).toBe(true);
    expect(ledgerReducer(open, { type: 'closeImport' }).importOpen).toBe(false);
  });

  it('demande confirmation avant de supprimer, et peut l’annuler', () => {
    const asked = ledgerReducer(withSelection('a'), { type: 'askDelete', ids: ['a', 'b'] });
    expect(asked.pendingDelete).toEqual(['a', 'b']);
    const cancelled = ledgerReducer(asked, { type: 'cancelDelete' });
    expect(cancelled.pendingDelete).toBeNull();
    expect(cancelled.selection).toEqual(new Set(['a']));
  });

  it('vide la sélection une fois la suppression confirmée', () => {
    const asked = ledgerReducer(withSelection('a'), { type: 'askDelete', ids: ['a'] });
    const done = ledgerReducer(asked, { type: 'deleteConfirmed' });
    expect(done.pendingDelete).toBeNull();
    expect(done.selection).toEqual(new Set());
  });
});

describe('suggestion de règle', () => {
  it('affiche puis masque la suggestion', () => {
    const suggestion = {
      match: 'boulangerie',
      type: 'depense' as const,
      categoryId: 'courses',
      memberId: null,
    };
    const shown = ledgerReducer(start(), { type: 'suggestRule', suggestion });
    expect(shown.ruleToSuggest).toEqual(suggestion);
    expect(ledgerReducer(shown, { type: 'suggestRule', suggestion: null }).ruleToSuggest).toBeNull();
  });
});
