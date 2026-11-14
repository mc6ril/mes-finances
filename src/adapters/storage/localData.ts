/** Préfixe des bases IndexedDB et des clés de stockage de l'application (versions locales comprises). */
const APP_PREFIX = 'mes-finances';

type BrowserStores = {
  indexedDB: IDBFactory;
  localStorage: Storage;
  sessionStorage: Storage;
};

const deleteDatabase = (factory: IDBFactory, name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const clearKeys = (storage: Storage): void => {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key !== null && key.startsWith(APP_PREFIX),
  );
  keys.forEach((key) => storage.removeItem(key));
};

/**
 * Efface de l'appareil les données de l'application hors cache Firestore (effacé à part) :
 * anciennes bases IndexedDB (une par espace), espace affiché, invitation en cours.
 */
export const clearBrowserData = async (
  stores: BrowserStores = {
    indexedDB,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
  },
): Promise<void> => {
  const databases =
    typeof stores.indexedDB.databases === 'function' ? await stores.indexedDB.databases() : [];
  await Promise.all(
    databases
      .map((database) => database.name ?? '')
      .filter((name) => name.startsWith(APP_PREFIX))
      .map((name) => deleteDatabase(stores.indexedDB, name)),
  );
  clearKeys(stores.localStorage);
  clearKeys(stores.sessionStorage);
};
