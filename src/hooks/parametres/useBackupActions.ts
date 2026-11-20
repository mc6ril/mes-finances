import { useCallback, useMemo, useReducer } from 'react';
import { isMainWorkspace } from '@/core/espaces/workspaces';
import { type RestoreRequest, restoreRequest, settingsSource } from '@/core/sauvegarde/backupContent';
import { mergeSettings } from '@/core/sauvegarde/settingsMerge';
import { todayIso } from '@/core/shared/dates';
import type { Dataset } from '@/core/shared/model';
import type { UserFile } from '@/core/shared/ports';
import {
  useDataset,
  useFileUseCases,
  useFinanceState,
  useFinanceStore,
  useFinanceUseCases,
} from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { useToast } from '@/hooks/useToast';
import { errorMessage } from '@/ui/errorMessages';
import { restoreMessage, settingsMessage } from '@/ui/labels/parametres/backup';
import { type BackupDialog, backupDialogsReducer, type FilePurpose, NO_BACKUP_DIALOG } from './backupDialogs';

/**
 * Actions de la carte Sauvegardes : lecture d'un fichier (avec son mot de passe s'il est protégé),
 * confirmation d'une restauration ou d'un import de réglages, export CSV, réinitialisation.
 */
export const useBackupActions = () => {
  const dataset = useDataset();
  const files = useFileUseCases();
  const { workspace, workspaces } = useFinanceState();
  const finance = useFinanceUseCases();
  const store = useFinanceStore();
  const report = useReport();
  const { notify } = useToast();
  const [dialogs, dispatch] = useReducer(backupDialogsReducer, NO_BACKUP_DIALOG);

  /** Lit le fichier (avec son mot de passe s'il est protégé) ; renvoie l'erreur à afficher. */
  const openFile = useCallback(
    async (file: UserFile, purpose: FilePurpose, password?: string): Promise<string | null> => {
      const result = await files.readBackupFile(file, password);
      if (!result.ok) {
        if (result.error.code === 'backup-password-required') {
          dispatch({ type: 'password-required', file, purpose });
          return null;
        }
        return errorMessage(result.error);
      }
      dispatch({ type: 'file-read' });
      if (purpose === 'restore') {
        const request = restoreRequest(result.value);
        if (!request.ok) {
          notify(errorMessage(request.error), 'error');
          return null;
        }
        dispatch({ type: 'restore-requested', request: request.value });
        return null;
      }
      const incoming = settingsSource(result.value, workspace);
      if (!incoming) {
        notify(
          'Aucun espace de ce nom dans la sauvegarde complète : choisis le fichier d’un espace.',
          'error',
        );
        return null;
      }
      dispatch({ type: 'settings-requested', dataset: incoming });
      return null;
    },
    [files, notify, workspace],
  );

  const pickFile = useCallback(
    (purpose: FilePurpose) => async (file: UserFile) => {
      const failure = await openFile(file, purpose);
      if (failure) {
        notify(failure, 'error');
      }
    },
    [openFile, notify],
  );

  const exportOperations = useCallback(() => {
    const saved = files.exportOperationsCsv({
      fileLabel: workspace.name,
      period: todayIso(),
      transactions: dataset.transactions,
      categories: dataset.categories,
      accounts: dataset.accounts,
    });
    if (!saved.ok) {
      notify(errorMessage(saved.error), 'error');
    }
  }, [files, workspace.name, dataset, notify]);

  const close = useCallback((dialog: BackupDialog) => dispatch({ type: 'closed', dialog }), []);

  const requestReset = useCallback(() => dispatch({ type: 'reset-requested' }), []);

  const confirmRestore = useCallback(
    (request: RestoreRequest) => {
      void report(store.restoreAll(request.entries, request.activeId), 'Sauvegarde complète restaurée');
      dispatch({ type: 'closed', dialog: 'restore' });
    },
    [report, store],
  );

  const confirmSettings = useCallback(
    (incoming: Dataset) => {
      void report(finance.importSettings(incoming), 'Réglages importés');
      dispatch({ type: 'closed', dialog: 'settings' });
    },
    [report, finance],
  );

  const confirmReset = useCallback(() => {
    void report(finance.resetWorkspace(), 'Espace réinitialisé');
    dispatch({ type: 'closed', dialog: 'reset' });
  }, [report, finance]);

  const restoreText = useMemo(
    () =>
      dialogs.restore &&
      restoreMessage(dialogs.restore, { main: workspaces.find(isMainWorkspace) ?? workspace, workspaces }),
    [dialogs.restore, workspaces, workspace],
  );

  const settingsText = useMemo(
    () => dialogs.settings && settingsMessage(mergeSettings(dataset, dialogs.settings).summary),
    [dialogs.settings, dataset],
  );

  return {
    workspace,
    workspaces,
    dialogs,
    restoreText,
    settingsText,
    openFile,
    pickFile,
    exportOperations,
    close,
    requestReset,
    confirmRestore,
    confirmSettings,
    confirmReset,
  };
};
