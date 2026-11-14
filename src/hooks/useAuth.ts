import { useCallback, useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '@/core/auth/model';
import type { Result } from '@/core/shared/errors';
import type { AuthState } from '@/core/store/AuthSession';
import type { AuthUseCases } from '@/core/usecases/auth';
import { errorMessage } from '@/ui/errorMessages';
import { useContainer } from './useFinance';

export const useAuthUseCases = (): AuthUseCases => useContainer().auth;

export const useAuthState = (): AuthState => {
  const { session } = useContainer();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
};

export const useCurrentUser = (): AuthUser => {
  const { user } = useAuthState();
  if (!user) {
    throw new Error('Utilisateur non connecté');
  }
  return user;
};

type AuthAction = {
  pending: boolean;
  error: string | null;
  clearError: () => void;
  /** Exécute l'action ; renvoie la valeur en cas de succès, null sinon (l'erreur est alors exposée). */
  run: <T>(action: () => Promise<Result<T>>) => Promise<T | null>;
};

/** État d'un formulaire d'authentification : envoi en cours et message d'erreur affiché sur place. */
export const useAuthAction = (): AuthAction => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(action: () => Promise<Result<T>>): Promise<T | null> => {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.ok) {
      return result.value;
    }
    // Fenêtre Google fermée volontairement : rien à signaler.
    if (result.error.code !== 'auth-cancelled') {
      setError(errorMessage(result.error));
    }
    return null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { pending, error, clearError, run };
};
