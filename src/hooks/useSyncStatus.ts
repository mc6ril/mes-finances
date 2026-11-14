import { useSyncExternalStore } from 'react';
import type { SyncStatus } from '@/core/sync/model';
import { useContainer } from './useFinance';

/** Envoi des modifications vers la base en ligne : hors ligne, en attente, refus du serveur. */
export const useSyncStatus = (): SyncStatus => {
  const { sync } = useContainer();
  return useSyncExternalStore(
    (onChange) => sync.onStatus(onChange),
    () => sync.getStatus(),
  );
};
