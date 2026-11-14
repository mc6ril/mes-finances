import { SyncMonitor } from '@/adapters/firestore/SyncMonitor';
import type { SyncStatus } from '@/core/sync/model';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
};

describe('suivi des écritures en arrière-plan', () => {
  it('compte les écritures en attente jusqu’à leur confirmation', async () => {
    const monitor = new SyncMonitor();
    const seen: SyncStatus[] = [];
    monitor.onStatus((status) => seen.push(status));
    const write = deferred();
    monitor.track(write.promise);
    expect(monitor.getStatus().pendingWrites).toBe(1);
    write.resolve();
    await vi.waitFor(() => expect(monitor.getStatus().pendingWrites).toBe(0));
    expect(seen.map((status) => status.pendingWrites)).toEqual([1, 0]);
  });

  it('garde le refus du serveur pour l’afficher, puis l’oublie à la demande', async () => {
    const monitor = new SyncMonitor();
    const write = deferred();
    monitor.track(write.promise);
    write.reject(Object.assign(new Error(), { code: 'permission-denied' }));
    await vi.waitFor(() => expect(monitor.getStatus().error).toEqual({ code: 'sync-permission-denied' }));
    monitor.clearError();
    expect(monitor.getStatus().error).toBeNull();
  });

  it('attend la fin des écritures, ou échoue après le délai', async () => {
    vi.useFakeTimers();
    try {
      const monitor = new SyncMonitor();
      expect(await monitor.flush(1000)).toEqual({ ok: true, value: undefined });
      const write = deferred();
      monitor.track(write.promise);
      const pending = monitor.flush(1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await pending).toEqual({ ok: false, error: { code: 'sync-pending-writes' } });
      const later = monitor.flush(1000);
      write.resolve();
      expect(await later).toEqual({ ok: true, value: undefined });
    } finally {
      vi.useRealTimers();
    }
  });

  it('considère une écriture refusée comme terminée pour la déconnexion', async () => {
    const monitor = new SyncMonitor();
    const write = deferred();
    monitor.track(write.promise);
    write.reject(new Error('refus'));
    expect(await monitor.flush(1000)).toEqual({ ok: true, value: undefined });
  });

  it('suit l’état du réseau', () => {
    const monitor = new SyncMonitor();
    monitor.setOffline(true);
    expect(monitor.getStatus().offline).toBe(true);
    monitor.setOffline(false);
    expect(monitor.getStatus().offline).toBe(false);
  });
});
