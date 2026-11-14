import { addDays, daysBetween } from '../shared/dates';
import type { IsoDate } from '../shared/model';
import type { BackupHistory } from './interface';

export const BACKUP_REMINDER_DAYS = 30;
export const REMINDER_SNOOZE_DAYS = 7;

export type BackupReminder = { kind: 'never' } | { kind: 'old'; days: number };

/**
 * Rappel de sauvegarde : plus de 30 jours depuis la dernière sauvegarde complète, ou aucune alors
 * que l'espace contient des opérations. Rien tant qu'il est masqué.
 */
export const backupReminder = (
  history: BackupHistory,
  hasTransactions: boolean,
  today: IsoDate,
): BackupReminder | null => {
  if (history.reminderHiddenUntil && today <= history.reminderHiddenUntil) {
    return null;
  }
  if (!history.lastFullBackupAt) {
    return hasTransactions ? { kind: 'never' } : null;
  }
  const days = daysBetween(history.lastFullBackupAt.slice(0, 10), today);
  return days > BACKUP_REMINDER_DAYS ? { kind: 'old', days } : null;
};

/** Masque le rappel pendant 7 jours à partir d'aujourd'hui. */
export const snoozedUntil = (today: IsoDate): IsoDate => addDays(today, REMINDER_SNOOZE_DAYS);
