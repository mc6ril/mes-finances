import type { SyncMonitor } from './SyncMonitor';

/** Reflète l'état du réseau du navigateur dans le suivi d'envoi. */
export const watchBrowserNetwork = (monitor: SyncMonitor): void => {
  if (typeof window === 'undefined') {
    return;
  }
  monitor.setOffline(!navigator.onLine);
  window.addEventListener('online', () => monitor.setOffline(false));
  window.addEventListener('offline', () => monitor.setOffline(true));
};
