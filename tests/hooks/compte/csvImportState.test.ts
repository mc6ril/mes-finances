import {
  columnCount,
  csvImportReducer,
  includedRows,
  initialCsvImportState,
  type CsvImportState,
} from '@/hooks/compte/csvImportState';
import type { ImportReviewRow } from '@/core/comptes/csvImport';

const table = [
  ['Date', 'Libellé', 'Montant'],
  ['05/11/2026', 'CB BOULANGERIE', '-4,50'],
];

const row = (include: boolean): ImportReviewRow => ({
  draft: {
    line: 2,
    date: '2026-11-05',
    label: 'CB',
    amount: -450,
    accountId: 'courant',
    type: 'depense',
    status: 'realise',
    categoryLabel: '',
  },
  include,
  duplicate: false,
  cardTotal: false,
  categoryId: '',
  type: 'depense',
  counterpartAccountId: null,
  rule: null,
});

const reviewing = (): CsvImportState =>
  csvImportReducer(
    csvImportReducer(initialCsvImportState(), { type: 'fileRead', fileName: 'f.csv', rows: table }),
    {
      type: 'reviewed',
      review: [row(true), row(false)],
      lineErrors: [{ line: 4, code: 'invalid-date' }],
    },
  );

describe('import d’un relevé : étapes', () => {
  it('démarre sur le choix du fichier, sans erreur, en-têtes cochés', () => {
    expect(initialCsvImportState()).toMatchObject({ step: 'file', error: null, hasHeader: true, rows: [] });
  });

  it('un fichier illisible reste sur le choix du fichier avec l’erreur, effacée au fichier suivant', () => {
    const failed = csvImportReducer(initialCsvImportState(), { type: 'fileFailed', error: 'Illisible' });
    expect(failed).toMatchObject({ step: 'file', error: 'Illisible' });
    expect(csvImportReducer(failed, { type: 'fileStarted' }).error).toBeNull();
  });

  it('un fichier lu passe aux colonnes, devinées depuis la première ligne', () => {
    const state = csvImportReducer(initialCsvImportState(), {
      type: 'fileRead',
      fileName: 'f.csv',
      rows: table,
    });
    expect(state).toMatchObject({ step: 'mapping', fileName: 'f.csv', rows: table });
    expect(state.mapping).toMatchObject({ date: 0, label: 1, amount: 2 });
  });

  it('modifie une colonne ou l’indication d’en-têtes', () => {
    const state = csvImportReducer(initialCsvImportState(), {
      type: 'fileRead',
      fileName: 'f.csv',
      rows: table,
    });
    expect(
      csvImportReducer(state, { type: 'mapColumn', field: 'category', column: 3 }).mapping.category,
    ).toBe(3);
    expect(
      csvImportReducer(state, { type: 'mapColumn', field: 'date', column: null }).mapping.date,
    ).toBeNull();
    expect(csvImportReducer(state, { type: 'setHasHeader', hasHeader: false }).hasHeader).toBe(false);
  });

  it('passe à la vérification, revient aux colonnes en gardant la vérification', () => {
    const state = reviewing();
    expect(state).toMatchObject({ step: 'review', lineErrors: [{ line: 4, code: 'invalid-date' }] });
    expect(csvImportReducer(state, { type: 'back' })).toMatchObject({
      step: 'mapping',
      review: state.review,
    });
  });

  it('modifie une seule ligne vérifiée', () => {
    const state = csvImportReducer(reviewing(), { type: 'updateRow', index: 1, patch: { include: true } });
    expect(state.review.map((entry) => entry.include)).toEqual([true, true]);
    expect(includedRows(reviewing())).toHaveLength(1);
  });

  it('compte les colonnes sur les 20 premières lignes', () => {
    expect(columnCount([])).toBe(0);
    expect(columnCount([['a'], ['a', 'b', 'c']])).toBe(3);
    const long = [...Array.from({ length: 20 }, () => ['a']), ['a', 'b', 'c', 'd']];
    expect(columnCount(long)).toBe(1);
  });
});
