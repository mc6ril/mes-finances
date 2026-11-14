import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { FirestoreAccountData } from '@/adapters/firestore/auth/FirestoreAccountData';

/** Suppression du compte de A (RGPD) : A possède un perso, deux communs, et est invité chez C. */
const A = 'owner-a';
const B = 'partner-b';
const C = 'stranger-c';

let env: RulesTestEnvironment;

const dbOf = (uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;

const workspace = (ownerId: string, memberIds: string[], kind: 'perso' | 'commun') => ({
  ownerId,
  memberIds,
  kind,
  name: kind,
  createdAt: Timestamp.now(),
  settings: { kind },
  schemaVersion: 10,
  layout: { transactions: 2 },
});

const invitation = (ownerId: string, workspaceId: string, usedBy: string | null) => ({
  workspaceId,
  ownerId,
  workspaceName: 'Commun',
  createdAt: Timestamp.now(),
  expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
  usedBy,
  usedAt: usedBy ? Timestamp.now() : null,
});

const asAdmin = async <T>(task: (db: Firestore) => Promise<T>): Promise<T> => {
  let result: T | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    result = await task(context.firestore() as unknown as Firestore);
  });
  return result as T;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances-account',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await asAdmin(async (db) => {
    const docs: Record<string, object> = {
      [`workspaces/perso-${A}`]: workspace(A, [A], 'perso'),
      [`workspaces/perso-${A}/data/transactions__0`]: { items: { t1: { id: 't1' } } },
      [`workspaces/perso-${A}/data/transactions__1`]: { items: {} },
      'workspaces/commun-ab': workspace(A, [A, B], 'commun'),
      'workspaces/commun-ab/data/transactions__0': { items: { t2: { id: 't2' } } },
      'workspaces/commun-seul': workspace(A, [A], 'commun'),
      'workspaces/commun-seul/data/transactions__0': { items: {} },
      'workspaces/commun-ca': workspace(C, [C, A], 'commun'),
      'workspaces/commun-ca/data/transactions__0': { items: { t3: { id: 't3' } } },
      [`workspaces/perso-${B}`]: workspace(B, [B], 'perso'),
      'invitations/a-utilisee-par-b-000000000000000000': invitation(A, 'commun-ab', B),
      'invitations/a-en-attente-0000000000000000000000': invitation(A, 'commun-seul', null),
      'invitations/c-utilisee-par-a-000000000000000000': invitation(C, 'commun-ca', A),
      'invitations/c-autre-00000000000000000000000000': invitation(C, 'commun-ca', null),
    };
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data);
    }
  });
});

describe('effacement des données d’un compte supprimé', () => {
  it('supprime ses espaces, transfère le commun partagé, quitte celui où il est invité', async () => {
    expect(await new FirestoreAccountData(dbOf(A), A).erase()).toEqual({ ok: true, value: undefined });
    const state = await asAdmin(async (db) => ({
      perso: (await getDoc(doc(db, `workspaces/perso-${A}`))).exists(),
      persoData: (await getDocs(collection(db, `workspaces/perso-${A}/data`))).size,
      seul: (await getDoc(doc(db, 'workspaces/commun-seul'))).exists(),
      seulData: (await getDocs(collection(db, 'workspaces/commun-seul/data'))).size,
      partage: (await getDoc(doc(db, 'workspaces/commun-ab'))).data(),
      partageData: (await getDocs(collection(db, 'workspaces/commun-ab/data'))).size,
      invite: (await getDoc(doc(db, 'workspaces/commun-ca'))).data(),
      persoB: (await getDoc(doc(db, `workspaces/perso-${B}`))).exists(),
      invitations: (await getDocs(collection(db, 'invitations'))).docs.map((item) => item.id),
    }));
    expect(state).toMatchObject({
      perso: false,
      persoData: 0,
      seul: false,
      seulData: 0,
      partage: { ownerId: B, memberIds: [B] },
      partageData: 1,
      invite: { ownerId: C, memberIds: [C] },
      persoB: true,
      invitations: ['c-autre-00000000000000000000000000'],
    });
  });

  it('peut être relancé sans erreur une fois tout effacé', async () => {
    const eraser = new FirestoreAccountData(dbOf(A), A);
    await eraser.erase();
    expect(await eraser.erase()).toEqual({ ok: true, value: undefined });
  });

  it('ne touche à rien chez les autres', async () => {
    expect(await new FirestoreAccountData(dbOf(C), C).erase()).toEqual({ ok: true, value: undefined });
    const state = await asAdmin(async (db) => ({
      persoA: (await getDoc(doc(db, `workspaces/perso-${A}`))).exists(),
      partage: (await getDoc(doc(db, 'workspaces/commun-ab'))).data(),
      transfere: (await getDoc(doc(db, 'workspaces/commun-ca'))).data(),
    }));
    expect(state.persoA).toBe(true);
    expect(state.partage).toMatchObject({ ownerId: A, memberIds: [A, B] });
    expect(state.transfere).toMatchObject({ ownerId: A, memberIds: [A] });
  });
});
