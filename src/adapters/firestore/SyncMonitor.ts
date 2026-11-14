import { fail, ok, type AppError, type Result } from '@/core/shared/errors';
import type { SyncGatewayInterface, SyncListener } from '@/core/sync/interface';
import { IDLE_SYNC, type SyncStatus } from '@/core/sync/model';
import { toSyncFailure } from './firestoreErrors';

/**
 * Écritures envoyées en arrière-plan : leur promesse ne se termine qu'à la confirmation du serveur
 * (jamais hors ligne). Les dépôts rendent la main dès la mise en file ; un refus arrive ici après coup.
 */
export class SyncMonitor implements SyncGatewayInterface {
  #status: SyncStatus = IDLE_SYNC;
  #pending = new Set<Promise<void>>();
  #listeners = new Set<SyncListener>();

  getStatus(): SyncStatus {
    return this.#status;
  }

  onStatus(listener: SyncListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #set(patch: Partial<SyncStatus>): void {
    this.#status = { ...this.#status, ...patch };
    this.#listeners.forEach((listener) => listener(this.#status));
  }

  track(write: Promise<unknown>): void {
    const settled = write.then(
      () => undefined,
      (error: unknown) => {
        this.#set({ error: toSyncFailure(error).error });
      },
    );
    this.#pending.add(settled);
    this.#set({ pendingWrites: this.#pending.size });
    void settled.finally(() => {
      this.#pending.delete(settled);
      this.#set({ pendingWrites: this.#pending.size });
    });
  }

  report(error: unknown): void {
    this.#set({ error: toSyncFailure(error).error });
  }

  raise(error: AppError): void {
    this.#set({ error });
  }

  clearError(): void {
    this.#set({ error: null });
  }

  setOffline(offline: boolean): void {
    if (offline !== this.#status.offline) {
      this.#set({ offline });
    }
  }

  async flush(timeoutMs: number): Promise<Result<void>> {
    if (this.#pending.size === 0) {
      return ok(undefined);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const outcome = await Promise.race([
      Promise.all([...this.#pending]).then(() => 'done' as const),
      timeout,
    ]);
    clearTimeout(timer);
    return outcome === 'done' ? ok(undefined) : fail('sync-pending-writes');
  }
}
