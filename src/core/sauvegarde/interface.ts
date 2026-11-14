import type { Result } from '../shared/errors';
import type { WorkspaceData } from './fullBackup';

/** Données des espaces à sauvegarder ou partager. */
export interface WorkspaceDataSourceInterface {
  allWorkspaceData(): Promise<Result<WorkspaceData[]>>;
  workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>>;
}

/** Suivi des sauvegardes de l'utilisateur, partagé entre ses appareils. */
export type BackupHistory = {
  /** Dernière sauvegarde complète exportée (horodatage ISO), null si jamais. */
  lastFullBackupAt: string | null;
  /** Rappel masqué jusqu'à cette date (incluse). */
  reminderHiddenUntil: string | null;
};

export interface BackupHistoryInterface {
  load(): Promise<Result<BackupHistory>>;
  /** Enregistre en arrière-plan (fonctionne hors ligne, envoyé au retour du réseau). */
  save(patch: Partial<BackupHistory>): Result<void>;
}
