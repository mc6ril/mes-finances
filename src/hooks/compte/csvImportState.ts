import {
  guessMapping,
  type ColumnMapping,
  type ImportError,
  type ImportReviewRow,
} from '@/core/comptes/csvImport';

/** Étapes de l'import d'un relevé : fichier, puis colonnes, puis vérification des lignes. */
export type CsvImportStep = 'file' | 'mapping' | 'review';

export type CsvImportState = {
  step: CsvImportStep;
  error: string | null;
  fileName: string;
  rows: string[][];
  hasHeader: boolean;
  mapping: ColumnMapping;
  review: ImportReviewRow[];
  lineErrors: ImportError[];
};

export type CsvImportAction =
  | { type: 'fileStarted' }
  | { type: 'fileFailed'; error: string }
  | { type: 'fileRead'; fileName: string; rows: string[][] }
  | { type: 'setHasHeader'; hasHeader: boolean }
  | { type: 'mapColumn'; field: keyof ColumnMapping; column: number | null }
  | { type: 'reviewed'; review: ImportReviewRow[]; lineErrors: ImportError[] }
  | { type: 'back' }
  | { type: 'updateRow'; index: number; patch: Partial<ImportReviewRow> };

const NO_MAPPING: ColumnMapping = {
  date: null,
  label: null,
  amount: null,
  debit: null,
  credit: null,
  category: null,
};

export const initialCsvImportState = (): CsvImportState => ({
  step: 'file',
  error: null,
  fileName: '',
  rows: [],
  hasHeader: true,
  mapping: NO_MAPPING,
  review: [],
  lineErrors: [],
});

export const csvImportReducer = (state: CsvImportState, action: CsvImportAction): CsvImportState => {
  switch (action.type) {
    case 'fileStarted':
      return { ...state, error: null };
    case 'fileFailed':
      return { ...state, error: action.error };
    case 'fileRead':
      return {
        ...state,
        fileName: action.fileName,
        rows: action.rows,
        mapping: guessMapping(action.rows[0] ?? []),
        step: 'mapping',
      };
    case 'setHasHeader':
      return { ...state, hasHeader: action.hasHeader };
    case 'mapColumn':
      return { ...state, mapping: { ...state.mapping, [action.field]: action.column } };
    case 'reviewed':
      return { ...state, review: action.review, lineErrors: action.lineErrors, step: 'review' };
    case 'back':
      return { ...state, step: 'mapping' };
    case 'updateRow':
      return {
        ...state,
        review: state.review.map((row, position) =>
          position === action.index ? { ...row, ...action.patch } : row,
        ),
      };
  }
};

/** Lignes cochées pour l'import. */
export const includedRows = (state: CsvImportState): ImportReviewRow[] =>
  state.review.filter((row) => row.include);

/** Nombre de colonnes du relevé, lu sur les 20 premières lignes. */
export const columnCount = (rows: string[][]): number =>
  Math.max(0, ...rows.slice(0, 20).map((row) => row.length));
