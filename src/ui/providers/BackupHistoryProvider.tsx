import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BackupHistory } from '@/core/sauvegarde/interface';
import { snoozedUntil } from '@/core/sauvegarde/reminder';
import { todayIso } from '@/core/shared/dates';
import { useFileUseCases, useFinanceState } from '@/hooks/useFinance';
import { useToast } from '@/hooks/useToast';
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

  const exportAll = useCallback(async () => {
    const now = new Date();
    const saved = await files.saveFullBackup(workspace.id, now);
    if (!saved.ok) {
      notify(errorMessage(saved.error), 'error');
      return;
    }
    setHistory({ lastFullBackupAt: now.toISOString(), reminderHiddenUntil: null });
    notify(`Sauvegarde complète exportée (${saved.value} espace${saved.value > 1 ? 's' : ''})`);
  }, [files, workspace.id, notify]);

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
  return <BackupHistoryContext.Provider value={value}>{children}</BackupHistoryContext.Provider>;
};

export default BackupHistoryProvider;
