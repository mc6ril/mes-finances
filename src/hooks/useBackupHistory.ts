import { useContext } from 'react';
import { BackupHistoryContext, type BackupHistoryValue } from '@/ui/providers/contexts';

export const useBackupHistory = (): BackupHistoryValue => {
  const value = useContext(BackupHistoryContext);
  if (!value) {
    throw new Error('BackupHistoryProvider manquant');
  }
  return value;
};
