import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { BackupHistory, BackupHistoryInterface } from '@/core/sauvegarde/interface';
import { ok, type Result } from '@/core/shared/errors';
import { toSyncFailure } from '@/adapters/firestore/firestoreErrors';
import type { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * users/{uid} : date de la dernière sauvegarde complète et rappel masqué. Lié au compte et non à
 * un espace (un espace commun est partagé), il suit l'utilisateur d'un appareil à l'autre.
 */
export class FirestoreBackupHistory implements BackupHistoryInterface {
  readonly #db: Firestore;
  readonly #userId: string;
  readonly #monitor: SyncMonitor;

  constructor(db: Firestore, userId: string, monitor: SyncMonitor) {
    this.#db = db;
    this.#userId = userId;
    this.#monitor = monitor;
  }

  #ref() {
    return doc(this.#db, 'users', this.#userId);
  }

  async load(): Promise<Result<BackupHistory>> {
    try {
      const snapshot = await getDoc(this.#ref());
      const data = snapshot.data() ?? {};
      return ok({
        lastFullBackupAt: stringOrNull(data.lastFullBackupAt),
        reminderHiddenUntil: stringOrNull(data.reminderHiddenUntil),
      });
    } catch (error) {
      // Hors ligne sans copie locale : inconnu ; l'interface ne montre alors aucun rappel.
      return toSyncFailure(error);
    }
  }

  save(patch: Partial<BackupHistory>): Result<void> {
    try {
      this.#monitor.track(setDoc(this.#ref(), patch, { merge: true }));
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }
}
