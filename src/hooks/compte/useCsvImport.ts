import { useCallback, useMemo, useReducer } from 'react';
import { membersOf } from '@/core/commun/household';
import {
  findHeaderRow,
  importDraftsFrom,
  isMappingComplete,
  mapRows,
  reviewImport,
  type ColumnMapping,
  type ImportReviewRow,
} from '@/core/comptes/csvImport';
import { useDataset, useFileUseCases, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { errorMessage } from '@/ui/errorMessages';
import { columnCount, csvImportReducer, includedRows, initialCsvImportState } from './csvImportState';

/** Import d'un relevé CSV sur un compte : lecture du fichier, colonnes, vérification puis enregistrement. */
export const useCsvImport = (accountId: string, onDone: () => void) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const files = useFileUseCases();
  const report = useReport();
  const [state, dispatch] = useReducer(csvImportReducer, undefined, initialCsvImportState);

  const readFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'fileStarted' });
      const parsed = await files.readCsvRows(file);
      if (!parsed.ok) {
        dispatch({ type: 'fileFailed', error: errorMessage(parsed.error) });
        return;
      }
      // Les lignes d'informations au-dessus du tableau (Crédit Agricole) sont ignorées.
      dispatch({
        type: 'fileRead',
        fileName: file.name,
        rows: parsed.value.slice(findHeaderRow(parsed.value)),
      });
    },
    [files],
  );

  const prepareReview = useCallback(() => {
    const { drafts, errors } = mapRows(state.rows, state.mapping, { accountId, hasHeader: state.hasHeader });
    const review = reviewImport(drafts, state.rows, {
      transactions: dataset.transactions,
      categories: dataset.categories,
      accounts: dataset.accounts,
      rules: dataset.settings.importRules ?? [],
      members: membersOf(dataset),
    });
    dispatch({ type: 'reviewed', review, lineErrors: errors });
  }, [state.rows, state.mapping, state.hasHeader, accountId, dataset]);

  const included = useMemo(() => includedRows(state), [state]);

  const confirm = useCallback(async () => {
    const imported = await report(
      finance.importTransactions(importDraftsFrom(state.review, state.fileName)),
      (count) => `${count} opération${count > 1 ? 's importées' : ' importée'}`,
    );
    if (imported) {
      onDone();
    }
  }, [report, finance, state.review, state.fileName, onDone]);

  return {
    state,
    included,
    columnCount: columnCount(state.rows),
    mappingComplete: isMappingComplete(state.mapping),
    readFile,
    prepareReview,
    confirm,
    setHasHeader: (hasHeader: boolean) => dispatch({ type: 'setHasHeader', hasHeader }),
    mapColumn: (field: keyof ColumnMapping, column: number | null) =>
      dispatch({ type: 'mapColumn', field, column }),
    back: () => dispatch({ type: 'back' }),
    updateRow: (index: number, patch: Partial<ImportReviewRow>) =>
      dispatch({ type: 'updateRow', index, patch }),
  };
};
