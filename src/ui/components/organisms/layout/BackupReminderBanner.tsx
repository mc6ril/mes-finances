import { Archive } from 'lucide-react';
import { backupReminder } from '@/core/sauvegarde/reminder';
import { useBackupHistory } from '@/hooks/useBackupHistory';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';

/** Rappel discret quand la dernière sauvegarde complète date de plus de 30 jours (ou n'existe pas). */
const BackupReminderBanner = () => {
  const { history, exportAll, hideReminder } = useBackupHistory();
  const dataset = useDataset();
  const { today } = usePeriod();
  const reminder = history && backupReminder(history, dataset.transactions.length > 0, today);
  if (!reminder) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-surface-muted-soft px-4 py-2 text-center text-xs text-ink-body"
    >
      <Archive className="h-3.5 w-3.5" aria-hidden />
      {reminder.kind === 'never'
        ? 'Tu n’as encore jamais exporté de sauvegarde complète.'
        : `Ta dernière sauvegarde complète date de ${reminder.days} jours.`}
      <button
        type="button"
        onClick={() => void exportAll()}
        className="font-medium text-accent-ink-medium hover:underline"
      >
        Sauvegarder maintenant
      </button>
      <button type="button" onClick={hideReminder} className="text-ink-subtle hover:underline">
        Masquer 7 jours
      </button>
    </div>
  );
};

export default BackupReminderBanner;
