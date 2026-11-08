import { useCallback } from 'react';
import type { Result } from '@/core/errors';
import { errorMessage } from '@/ui/errorMessages';
import { useToast } from './useToast';

type Success<T> = string | ((value: T) => string) | null;

/**
 * Affiche le résultat d'un cas d'usage : toast d'erreur, ou message de succès optionnel.
 * Renvoie true si l'opération a réussi.
 */
export const useReport = () => {
  const { notify } = useToast();

  const show = useCallback(
    <T>(result: Result<T>, success: Success<T>): boolean => {
      if (!result.ok) {
        notify(errorMessage(result.error), 'error');
        return false;
      }
      const message = typeof success === 'function' ? success(result.value) : success;
      if (message) {
        notify(message);
      }
      return true;
    },
    [notify],
  );

  return useCallback(
    async <T>(pending: Result<T> | Promise<Result<T>>, success: Success<T> = null): Promise<boolean> =>
      show(await pending, success),
    [show],
  );
};
