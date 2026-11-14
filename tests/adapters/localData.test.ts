import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { clearBrowserData } from '@/adapters/storage/localData';

const memoryStorage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    keys: () => [...values.keys()],
  };
};

describe('effacement des données de l’appareil', () => {
  it('supprime les anciennes bases et les préférences de l’application, rien d’autre', async () => {
    for (const name of ['mes-finances', 'mes-finances-espace-w1', 'mes-finances-demo', 'autre-site']) {
      (await openDB(name, 1)).close();
    }
    const local = memoryStorage({
      'mes-finances:espaces': '[]',
      'mes-finances:espace-actif:owner-a': 'perso',
      'autre:cle': 'x',
    });
    const session = memoryStorage({ 'mes-finances:invitation': 'token' });
    await clearBrowserData({ indexedDB, localStorage: local, sessionStorage: session });
    const names = (await indexedDB.databases()).map((database) => database.name);
    expect(names).toEqual(['autre-site']);
    expect(local.keys()).toEqual(['autre:cle']);
    expect(session.keys()).toEqual([]);
  });
});
