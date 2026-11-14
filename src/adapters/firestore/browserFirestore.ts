import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { SyncMonitor } from './SyncMonitor';

/** Cache local persistant (IndexedDB), partagé entre onglets : la saisie continue hors ligne. */
export const openBrowserFirestore = (app: FirebaseApp): Firestore => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Déjà initialisée pour cette application (rechargement à chaud).
    return getFirestore(app);
  }
};

const CLEAR_RETRY_DELAYS_MS = [0, 400, 1200];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ferme la base et efface son cache local. Un autre onglet encore ouvert empêche l'effacement :
 * il se ferme lui aussi à la déconnexion, d'où quelques nouvelles tentatives.
 */
export const closeBrowserFirestore = async (db: Firestore): Promise<void> => {
  await terminate(db);
  let lastError: unknown = null;
  for (const delay of CLEAR_RETRY_DELAYS_MS) {
    await wait(delay);
    try {
      await clearIndexedDbPersistence(db);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

/** Reflète l'état du réseau du navigateur dans le suivi d'envoi. */
export const watchBrowserNetwork = (monitor: SyncMonitor): void => {
  if (typeof window === 'undefined') {
    return;
  }
  monitor.setOffline(!navigator.onLine);
  window.addEventListener('online', () => monitor.setOffline(false));
  window.addEventListener('offline', () => monitor.setOffline(true));
};
