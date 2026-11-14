import type { AppError } from '../shared/errors';
import type { AuthState } from '../store/AuthSession';
import type { UserDataBackendInterface } from '../sync/interface';

export type DataSessionPorts = {
  session: { getSnapshot(): AuthState; subscribe(listener: () => void): () => void };
  store: { start(): Promise<void>; stop(): void };
  backend: UserDataBackendInterface;
  onError: (error: AppError) => void;
};

/**
 * Ouvre les données de l'utilisateur connecté (adresse confirmée) et les ferme à la déconnexion,
 * en effaçant ce qui reste sur l'appareil. Les transitions s'enchaînent : les données d'un compte
 * sont fermées avant que celles d'un autre ne s'ouvrent. Renvoie de quoi se détacher de la session.
 */
export const bindUserData = ({ session, store, backend, onError }: DataSessionPorts): (() => void) => {
  let target: string | null = null;
  let connected: string | null = null;
  let closing: Promise<void> | null = null;

  const close = async (): Promise<void> => {
    store.stop();
    connected = null;
    const disconnected = await backend.disconnect();
    if (!disconnected.ok) {
      onError(disconnected.error);
    }
  };

  const apply = (): void => {
    const { status, user } = session.getSnapshot();
    target = status === 'signed-in' && user ? user.id : null;
    if (closing || connected === target) {
      return;
    }
    if (connected) {
      closing = close().finally(() => {
        closing = null;
        apply();
      });
      return;
    }
    if (target) {
      connected = target;
      backend.connect(target);
      void store.start();
    }
  };

  apply();
  return session.subscribe(apply);
};
