import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, type Firestore } from 'firebase/firestore';
import { FirestoreAccountData } from '@/adapters/firestore/auth/FirestoreAccountData';
import { FirestoreFinanceRepository } from '@/adapters/firestore/store/FirestoreFinanceRepository';
import { FirestoreSharing } from '@/adapters/firestore/partage/FirestoreSharing';
import { FirestoreWorkspaceRegistry } from '@/adapters/firestore/espaces/FirestoreWorkspaceRegistry';
import { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';
import { toDocumentId } from '@/adapters/firestore/espaces/workspaceIds';
import { randomToken } from '@/adapters/ids/randomToken';
import { FinanceStore } from '@/core/store/FinanceStore';
import { createSharingUseCases } from '@/core/usecases/sharing';

/** Parcours complet : A et B partagent un commun, puis suppriment leur compte ; rien ne doit rester. */
const A = 'owner-a';
const B = 'partner-b';

let env: RulesTestEnvironment;

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

const device = (uid: string) => {
  const db = env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
  const monitor = new SyncMonitor();
  const store = new FinanceStore(
    (workspaceId) => new FirestoreFinanceRepository(db, toDocumentId(workspaceId, uid), monitor),
    new FirestoreWorkspaceRegistry(db, uid, monitor, memoryStorage()),
    () => `id-${Math.random().toString(36).slice(2)}`,
  );
  let pending: string | null = null;
  const sharing = createSharingUseCases({
    sharing: new FirestoreSharing(db, uid, monitor),
    pending: { remember: (token) => void (pending = token), take: () => pending },
    newToken: randomToken,
    now: () => new Date(),
  });
  return { db, monitor, store, sharing, accountData: new FirestoreAccountData(db, uid) };
};

const everything = async () => {
  const found: string[] = [];
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const workspaces = await getDocs(collection(db, 'workspaces'));
    found.push(...workspaces.docs.map((item) => item.ref.path));
    const invitations = await getDocs(collection(db, 'invitations'));
    found.push(...invitations.docs.map((item) => item.ref.path));
    // Données orphelines : sous-collections d'espaces supprimés (le document parent n'existe plus).
    for (const id of [`perso-${A}`, `perso-${B}`, ...workspaces.docs.map((item) => item.id), 'commun']) {
      const data = await getDocs(collection(db, `workspaces/${id}/data`));
      found.push(...data.docs.map((item) => item.ref.path));
    }
  });
  return found;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances-lifecycle',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('cycle de vie de deux comptes qui partagent un commun', () => {
  it('ne laisse ni invitation consommée ni donnée orpheline', async () => {
    const a = device(A);
    await a.store.start();
    expect(await a.store.createWorkspace('Commun', 'commun')).toEqual({ ok: true, value: undefined });
    const commun = a.store.getSnapshot().workspace;
    await a.monitor.flush(5000);
    const invitation = await a.sharing.invite(commun);
    expect(invitation.ok ? null : invitation.error).toBeNull();
    const token = invitation.ok ? invitation.value.token : '';

    const b = device(B);
    await b.store.start();
    expect(await b.sharing.accept(token, B)).toEqual({ ok: true, value: commun.id });
    await b.monitor.flush(5000);

    // Une invitation consommée ne sert plus : elle disparaît.
    const afterJoin = await everything();
    expect(afterJoin.filter((path) => path.startsWith('invitations/'))).toEqual([]);

    b.store.stop();
    expect(await b.accountData.erase()).toEqual({ ok: true, value: undefined });
    a.store.stop();
    expect(await a.accountData.erase()).toEqual({ ok: true, value: undefined });
    expect(await everything()).toEqual([]);
  });
});
