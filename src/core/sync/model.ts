import type { AppError } from '../shared/errors';

/** État de l'envoi des modifications vers la base en ligne. */
export type SyncStatus = {
  /** Écritures enregistrées sur l'appareil, pas encore confirmées par le serveur. */
  pendingWrites: number;
  offline: boolean;
  /** Dernier refus du serveur (droits, quota…), constaté après coup. */
  error: AppError | null;
};

export const IDLE_SYNC: SyncStatus = { pendingWrites: 0, offline: false, error: null };

/** Délai laissé aux écritures en attente avant une déconnexion. */
export const SIGN_OUT_FLUSH_MS = 5000;
