import { useContext } from 'react';
import { ToastContext, type ToastValue } from '@/ui/providers/contexts';

export const useToast = (): ToastValue => {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('ToastProvider manquant');
  }
  return value;
};
