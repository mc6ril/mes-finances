import { useEffect } from 'react';
import { errorMessage } from '@/ui/errorMessages';
import { useContainer, useFinanceState } from './useFinance';
import { useSyncStatus } from './useSyncStatus';
import { useToast } from './useToast';

export const useSyncErrorNotice = (): void => {
  const { syncError } = useFinanceState();
  const { sync } = useContainer();
  const { error: remoteError } = useSyncStatus();
  const { notify } = useToast();
  useEffect(() => {
    if (syncError) {
      notify(`Mise à jour automatique impossible : ${errorMessage(syncError)}`, 'error');
    }
  }, [syncError, notify]);
  useEffect(() => {
    if (remoteError) {
      notify(errorMessage(remoteError), 'error');
      sync.clearError();
    }
  }, [remoteError, notify, sync]);
};
