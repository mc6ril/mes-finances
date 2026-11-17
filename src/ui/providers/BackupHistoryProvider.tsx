import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { BackupHistory } from '@/core/sauvegarde/interface';
import { snoozedUntil } from '@/core/sauvegarde/reminder';
import { todayIso } from '@/core/shared/dates';
import { useFileUseCases, useFinanceState } from '@/hooks/useFinance';
import { useToast } from '@/hooks/useToast';
import BackupPasswordDialog from '@/ui/components/organisms/modals/BackupPasswordDialog';
import { errorMessage } from '@/ui/errorMessages';
import { BackupHistoryContext } from './contexts';

type BackupHistoryProviderProps = { children: ReactNode };

/** Date de la dernière sauvegarde complète de l'utilisateur, partagée par l'onglet Sauvegardes et le rappel. */
const BackupHistoryProvider = ({ children }: BackupHistoryProviderProps) => {
  const files = useFileUseCases();
  const { workspace } = useFinanceState();
  const { notify } = useToast();
  const [history, setHistory] = useState<BackupHistory | null>(null);

  useEffect(() => {
    let active = true;
    void files.backupHistory().then((loaded) => {
      if (active && loaded.ok) {
        setHistory(loaded.value);
      }
    });
    return () => {
      active = false;
    };
  }, [files]);

  // L'export demande toujours un mot de passe : la fenêtre s'ouvre, le fichier part après sa saisie.
  const [askingPassword, setAskingPassword] = useState(false);

  const exportAll = useCallback(async () => {
    setAskingPassword(true);
  }, []);

  const exportWith = async (password: string): Promise<string | null> => {
    const now = new Date();
    const saved = await files.saveFullBackup(workspace.id, password, now);
    if (!saved.ok) {
      return errorMessage(saved.error);
    }
    setAskingPassword(false);
    setHistory({ lastFullBackupAt: now.toISOString(), reminderHiddenUntil: null });
    notify(`Sauvegarde complète exportée (${saved.value} espace${saved.value > 1 ? 's' : ''})`);
    return null;
  };

  const hideReminder = useCallback(() => {
    const now = new Date();
    const hidden = files.hideBackupReminder(now);
    if (!hidden.ok) {
      notify(errorMessage(hidden.error), 'error');
      return;
    }
    const reminderHiddenUntil = snoozedUntil(todayIso(now));
    setHistory((current) => current && { ...current, reminderHiddenUntil });
  }, [files, notify]);

  const value = useMemo(() => ({ history, exportAll, hideReminder }), [history, exportAll, hideReminder]);
  return (
    <BackupHistoryContext.Provider value={value}>
      {children}
      {askingPassword && (
        <BackupPasswordDialog mode="create" onSubmit={exportWith} onCancel={() => setAskingPassword(false)} />
      )}
    </BackupHistoryContext.Provider>
  );
};

export default BackupHistoryProvider;
