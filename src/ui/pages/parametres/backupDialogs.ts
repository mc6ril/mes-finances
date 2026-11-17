import type { RestoreRequest } from '@/core/sauvegarde/backupContent';
import type { UserFile } from '@/core/shared/ports';
import type { Dataset } from '@/core/shared/model';

/** Usage du fichier choisi : restaurer une sauvegarde complète, ou n'en importer que les réglages. */
export type FilePurpose = 'restore' | 'settings';

/** Dialogues de la carte Sauvegardes : un seul état, pour qu'ils ne se contredisent jamais. */
export type BackupDialogs = {
  /** Sauvegarde complète lue, en attente de confirmation. */
  restore: RestoreRequest | null;
  /** Réglages lus, en attente de confirmation. */
  settings: Dataset | null;
  /** Sauvegarde protégée choisie : on attend son mot de passe avant de la lire. */
  locked: { file: UserFile; purpose: FilePurpose } | null;
  reset: boolean;
};

export type BackupDialog = 'restore' | 'settings' | 'locked' | 'reset';

export type BackupDialogsAction =
  | { type: 'restore-requested'; request: RestoreRequest }
  | { type: 'settings-requested'; dataset: Dataset }
  | { type: 'password-required'; file: UserFile; purpose: FilePurpose }
  | { type: 'file-read' }
  | { type: 'reset-requested' }
  | { type: 'closed'; dialog: BackupDialog };

export const NO_BACKUP_DIALOG: BackupDialogs = { restore: null, settings: null, locked: null, reset: false };

const CLOSED: Record<BackupDialog, Partial<BackupDialogs>> = {
  restore: { restore: null },
  settings: { settings: null },
  locked: { locked: null },
  reset: { reset: false },
};

export const backupDialogsReducer = (state: BackupDialogs, action: BackupDialogsAction): BackupDialogs => {
  switch (action.type) {
    case 'restore-requested':
      return { ...state, locked: null, restore: action.request };
    case 'settings-requested':
      return { ...state, locked: null, settings: action.dataset };
    case 'password-required':
      return { ...state, locked: { file: action.file, purpose: action.purpose } };
    case 'file-read':
      return { ...state, locked: null };
    case 'reset-requested':
      return { ...state, reset: true };
    case 'closed':
      return { ...state, ...CLOSED[action.dialog] };
  }
};
