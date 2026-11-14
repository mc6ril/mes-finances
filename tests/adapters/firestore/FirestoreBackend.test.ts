import type { Firestore } from 'firebase/firestore';
import { FirestoreBackend } from '@/adapters/firestore/FirestoreBackend';

const fakeDb = (name: string) => ({ name }) as unknown as Firestore;

const setup = (closeFails = false) => {
  const opened: Firestore[] = [];
  const closed: Firestore[] = [];
  let cleared = 0;
  const backend = new FirestoreBackend({
    openFirestore: () => {
      const db = fakeDb(`db-${opened.length + 1}`);
      opened.push(db);
      return db;
    },
    closeFirestore: async (db) => {
      if (closeFails) {
        throw new Error('onglet ouvert');
      }
      closed.push(db);
    },
    clearLocalData: async () => {
      cleared += 1;
    },
    storage: { getItem: () => null, setItem: () => undefined },
  });
  return { backend, opened, closed, cleared: () => cleared };
};

describe('données de l’utilisateur en ligne', () => {
  it('refuse l’accès aux données tant que personne n’est connecté', async () => {
    const { backend } = setup();
    expect(await backend.registry.load()).toEqual({ ok: false, error: { code: 'sync-failed' } });
    expect(await backend.repository('perso').load()).toEqual({ ok: false, error: { code: 'sync-failed' } });
    expect(backend.repository('perso').watch(() => undefined)).toBeTypeOf('function');
    expect(await backend.accountData.erase()).toEqual({ ok: false, error: { code: 'sync-failed' } });
  });

  it('ouvre une base par connexion et l’efface de l’appareil à la déconnexion', async () => {
    const { backend, opened, closed, cleared } = setup();
    backend.connect('owner-a');
    expect(opened).toHaveLength(1);
    expect(await backend.disconnect()).toEqual({ ok: true, value: undefined });
    expect(closed).toEqual(opened);
    expect(cleared()).toBe(1);
    backend.connect('partner-b');
    expect(opened).toHaveLength(2);
    expect(opened[1]).not.toBe(opened[0]);
  });

  it('efface aussi les anciennes données sans connexion en cours', async () => {
    const { backend, closed, cleared } = setup();
    expect(await backend.disconnect()).toEqual({ ok: true, value: undefined });
    expect(closed).toEqual([]);
    expect(cleared()).toBe(1);
  });

  it('signale un cache qui n’a pas pu être effacé, sans garder la connexion', async () => {
    const { backend, cleared } = setup(true);
    backend.connect('owner-a');
    expect(await backend.disconnect()).toEqual({ ok: false, error: { code: 'sync-local-data-not-cleared' } });
    expect(cleared()).toBe(1);
    expect(await backend.registry.load()).toEqual({ ok: false, error: { code: 'sync-failed' } });
  });
});
