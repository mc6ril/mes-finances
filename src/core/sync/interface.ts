import type { AppError, Result } from '../shared/errors';
import type { SyncStatus } from './model';

export type SyncListener = (status: SyncStatus) => void;

/** Suivi des écritures envoyées en arrière-plan (elles continuent hors ligne). */
export interface SyncGatewayInterface {
  getStatus(): SyncStatus;
  onStatus(listener: SyncListener): () => void;
  /** Attend que les écritures en attente soient confirmées ; échoue (`sync-pending-writes`) après le délai. */
  flush(timeoutMs: number): Promise<Result<void>>;
  /** L'erreur a été montrée : on l'oublie. */
  clearError(): void;
  /** Signale un problème constaté hors d'une écriture (déconnexion incomplète…). */
  raise(error: AppError): void;
}

/** Données d'un utilisateur : ouvertes à la connexion, effacées de l'appareil à la déconnexion. */
export interface UserDataBackendInterface {
  connect(userId: string): void;
  /** Ferme l'accès et efface tout ce qui reste sur l'appareil (cache, anciennes bases, préférences). */
  disconnect(): Promise<Result<void>>;
}
