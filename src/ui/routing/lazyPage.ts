import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

type PageModule = { default: ComponentType };

export type LazyPage = {
  Page: LazyExoticComponent<ComponentType>;
  /** Télécharge la page sans l'afficher, sans erreur en cas d'échec ; une seule fois. */
  preload: () => Promise<void>;
};

const RELOAD_KEY = 'page-reload-at';
const RELOAD_MIN_INTERVAL_MS = 10_000;
const RETRY_DELAY_MS = 5_000;

/** Rechargement récent dû à une page introuvable : on n'en refait pas, pour ne jamais boucler. */
const reloadedRecently = (): boolean => {
  try {
    return Date.now() - Number(window.sessionStorage.getItem(RELOAD_KEY)) < RELOAD_MIN_INTERVAL_MS;
  } catch {
    return true;
  }
};

const markReload = () => {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sans stockage, reloadedRecently() répond oui : pas de rechargement en boucle.
  }
};

const serverReachable = async (): Promise<boolean> => {
  try {
    const response = await fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
};

/** Retour du réseau signalé par le navigateur, ou quelques secondes écoulées. */
const waitForRetry = () =>
  new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', done);
      resolve();
    };
    const timer = window.setTimeout(done, RETRY_DELAY_MS);
    window.addEventListener('online', done);
  });

/**
 * Page impossible à télécharger au moment de l'afficher :
 * - serveur injoignable (hors ligne) : nouvel essai au retour du réseau, la page actuelle reste affichée ;
 * - serveur joignable : l'application a été redéployée depuis l'ouverture (les fichiers changent
 *   de nom à chaque version), un rechargement récupère la nouvelle version.
 */
const recover = async (fetchPage: () => Promise<PageModule>, error: unknown): Promise<PageModule> => {
  if (!(await serverReachable())) {
    await waitForRetry();
    return fetchPage().catch((next: unknown) => recover(fetchPage, next));
  }
  if (reloadedRecently()) {
    throw error;
  }
  markReload();
  window.location.reload();
  return new Promise<never>(() => undefined);
};

/** Page chargée à la demande, préchargeable avant la navigation. */
export const lazyPage = (load: () => Promise<PageModule>): LazyPage => {
  let pending: Promise<PageModule> | null = null;
  const fetchPage = () =>
    (pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    }));
  return {
    Page: lazy(() => fetchPage().catch((error: unknown) => recover(fetchPage, error))),
    preload: () =>
      fetchPage().then(
        () => undefined,
        () => undefined,
      ),
  };
};
