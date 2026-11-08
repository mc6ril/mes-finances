import { useEffect } from 'react';
import { errorMessage } from '@/ui/errorMessages';
import { useFinanceState } from './useFinance';
import { useToast } from './useToast';

export const useSyncErrorNotice = (): void => {
  const { syncError } = useFinanceState();
  const { notify } = useToast();
  useEffect(() => {
    if (syncError) {
      notify(`Mise à jour automatique impossible : ${errorMessage(syncError)}`, 'error');
    }
  }, [syncError, notify]);
};
