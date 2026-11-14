import { fail, ok, type Result } from '@/core/shared/errors';
import { IDLE_SYNC, type SyncStatus } from '@/core/sync/model';
import type { SyncGatewayInterface, UserDataBackendInterface } from '@/core/sync/interface';

/** Faux suivi d'envoi : `pending` simule des écritures qui ne partent pas (hors ligne). */
export const fakeSync = (pending = false): SyncGatewayInterface & { flushes: number[] } => {
  const flushes: number[] = [];
  return {
    flushes,
    getStatus: (): SyncStatus => ({ ...IDLE_SYNC, pendingWrites: pending ? 1 : 0 }),
    onStatus: () => () => undefined,
    clearError: () => undefined,
    raise: () => undefined,
    flush: async (timeoutMs: number): Promise<Result<void>> => {
      flushes.push(timeoutMs);
      return pending ? fail('sync-pending-writes') : ok(undefined);
    },
  };
};

export type BackendCall = { kind: 'connect'; userId: string } | { kind: 'disconnect' };

export const fakeBackend = (disconnectResult: Result<void> = ok(undefined)) => {
  const calls: BackendCall[] = [];
  const backend: UserDataBackendInterface = {
    connect: (userId) => {
      calls.push({ kind: 'connect', userId });
    },
    disconnect: async () => {
      calls.push({ kind: 'disconnect' });
      return disconnectResult;
    },
  };
  return { backend, calls };
};
