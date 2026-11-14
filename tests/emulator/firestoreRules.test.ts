import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

/**
 * Règles Firestore, sur l'émulateur.
 * A et B partagent un espace commun ; C est un autre compte inscrit ; U n'a pas confirmé son adresse.
 */
const OWNER = 'owner-a';
const PARTNER = 'partner-b';
const STRANGER = 'stranger-c';
const UNVERIFIED = 'unverified-u';

const COMMON = 'commun-ab';
const PERSO_A = `perso-${OWNER}`;
const PERSO_B = `perso-${PARTNER}`;
const TOKEN = 'k3Jd9xQ2mZ7vN4pL8sT1wY6bR0cF5hGa';
const DAY = 24 * 60 * 60 * 1000;

let env: RulesTestEnvironment;

const verified = (uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
const unverified = (uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: false }).firestore() as unknown as Firestore;
const anonymous = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

const workspaceDoc = (ownerId: string, kind: 'perso' | 'commun', memberIds = [ownerId]) => ({
  ownerId,
  memberIds,
  kind,
  name: kind === 'perso' ? 'Perso' : 'Commun',
  schemaVersion: 10,
  settings: { kind },
  layout: { transactions: 1 },
  createdAt: Timestamp.fromMillis(0),
});

const invitationDoc = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: COMMON,
  ownerId: OWNER,
  workspaceName: 'Commun',
  createdAt: Timestamp.now(),
  expiresAt: Timestamp.fromMillis(Date.now() + 7 * DAY),
  usedBy: null,
  usedAt: null,
  ...overrides,
});

const seed = async (data: Record<string, Record<string, unknown>>) => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const [path, value] of Object.entries(data)) {
      await setDoc(doc(db, path), value);
    }
  });
};

const seedBase = (common = workspaceDoc(OWNER, 'commun')) =>
  seed({
    [`workspaces/${PERSO_A}`]: workspaceDoc(OWNER, 'perso'),
    [`workspaces/${PERSO_A}/data/transactions__0`]: { items: {} },
    [`workspaces/${PERSO_B}`]: workspaceDoc(PARTNER, 'perso'),
    [`workspaces/${PERSO_B}/data/transactions__0`]: { items: {} },
    [`workspaces/${COMMON}`]: common,
    [`workspaces/${COMMON}/data/transactions__0`]: { items: {} },
  });

const seedShared = () => seedBase(workspaceDoc(OWNER, 'commun', [OWNER, PARTNER]));

/** Acceptation : invitation consommée et ajout à l'espace, dans un même lot atomique. */
const accept = (
  db: Firestore,
  uid: string,
  token = TOKEN,
  workspaceId = COMMON,
  memberIds = [OWNER, uid],
) => {
  const batch = writeBatch(db);
  batch.update(doc(db, `invitations/${token}`), { usedBy: uid, usedAt: serverTimestamp() });
  batch.update(doc(db, `workspaces/${workspaceId}`), { memberIds, lastInvitation: token });
  return batch.commit();
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('accès aux espaces', () => {
  beforeEach(seedShared);

  it('chacun lit son espace perso, personne d’autre', async () => {
    await assertSucceeds(getDoc(doc(verified(OWNER), `workspaces/${PERSO_A}`)));
    await assertSucceeds(getDoc(doc(verified(PARTNER), `workspaces/${PERSO_B}`)));
    await assertFails(getDoc(doc(verified(PARTNER), `workspaces/${PERSO_A}`)));
    await assertFails(getDoc(doc(verified(STRANGER), `workspaces/${PERSO_A}`)));
    await assertFails(getDoc(doc(verified(OWNER), `workspaces/${PERSO_B}`)));
  });

  it('A et B lisent et modifient les données du commun, C non', async () => {
    const path = `workspaces/${COMMON}/data/transactions__0`;
    await assertSucceeds(getDoc(doc(verified(OWNER), path)));
    await assertSucceeds(getDoc(doc(verified(PARTNER), path)));
    await assertSucceeds(updateDoc(doc(verified(PARTNER), path), { 'items.t1': { id: 't1' } }));
    await assertFails(getDoc(doc(verified(STRANGER), path)));
    await assertFails(updateDoc(doc(verified(STRANGER), path), { 'items.t2': { id: 't2' } }));
    await assertFails(getDocs(collection(verified(STRANGER), `workspaces/${COMMON}/data`)));
  });

  it('les données perso sont réservées au propriétaire', async () => {
    const path = `workspaces/${PERSO_A}/data/transactions__0`;
    await assertSucceeds(getDocs(collection(verified(OWNER), `workspaces/${PERSO_A}/data`)));
    await assertFails(getDoc(doc(verified(PARTNER), path)));
    await assertFails(setDoc(doc(verified(STRANGER), `workspaces/${PERSO_A}/data/goals__0`), { items: {} }));
  });

  it('la liste des espaces ne renvoie que ceux dont on est membre', async () => {
    const mine = (uid: string) =>
      getDocs(query(collection(verified(uid), 'workspaces'), where('memberIds', 'array-contains', uid)));
    expect((await mine(OWNER)).docs.map((item) => item.id).sort()).toEqual([COMMON, PERSO_A]);
    expect((await mine(PARTNER)).docs.map((item) => item.id).sort()).toEqual([COMMON, PERSO_B]);
    expect((await mine(STRANGER)).docs).toEqual([]);
    await assertFails(getDocs(collection(verified(STRANGER), 'workspaces')));
  });

  it('refuse tout accès sans adresse confirmée ou sans connexion', async () => {
    await seed({ [`workspaces/perso-${UNVERIFIED}`]: workspaceDoc(UNVERIFIED, 'perso') });
    await assertFails(getDoc(doc(unverified(UNVERIFIED), `workspaces/perso-${UNVERIFIED}`)));
    await assertFails(getDoc(doc(unverified(OWNER), `workspaces/${PERSO_A}`)));
    await assertFails(getDoc(doc(anonymous(), `workspaces/${COMMON}`)));
    await assertFails(
      setDoc(doc(unverified(UNVERIFIED), 'workspaces/neuf'), {
        ...workspaceDoc(UNVERIFIED, 'perso'),
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('création et modification d’un espace', () => {
  beforeEach(seedShared);

  const created = (uid: string, overrides: Record<string, unknown> = {}) => ({
    ...workspaceDoc(uid, 'perso'),
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('crée un espace dont on est le seul membre, avec ses données dans le même lot', async () => {
    const db = verified(STRANGER);
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/perso-${STRANGER}`), created(STRANGER));
    batch.set(doc(db, `workspaces/perso-${STRANGER}/data/transactions__0`), { items: {} });
    await assertSucceeds(batch.commit());
  });

  it('crée un espace sans réglages, complétés ensuite par un membre', async () => {
    const db = verified(STRANGER);
    const ref = doc(db, 'workspaces/nu');
    await assertSucceeds(
      setDoc(ref, {
        ownerId: STRANGER,
        memberIds: [STRANGER],
        kind: 'perso',
        name: 'Perso',
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(ref, { settings: { kind: 'perso' }, schemaVersion: 10, layout: { audit: 1 } }),
    );
    await assertFails(
      setDoc(doc(db, 'workspaces/sans-nature'), {
        ownerId: STRANGER,
        memberIds: [STRANGER],
        name: 'X',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('refuse un espace créé pour quelqu’un d’autre ou avec un autre membre', async () => {
    const db = verified(STRANGER);
    await assertFails(setDoc(doc(db, 'workspaces/x1'), created(STRANGER, { ownerId: OWNER })));
    await assertFails(setDoc(doc(db, 'workspaces/x2'), created(STRANGER, { memberIds: [STRANGER, OWNER] })));
    await assertFails(setDoc(doc(db, 'workspaces/x3'), created(STRANGER, { kind: 'autre' })));
    await assertFails(setDoc(doc(db, 'workspaces/x4'), created(STRANGER, { lastInvitation: TOKEN })));
    await assertFails(
      setDoc(doc(db, 'workspaces/x5'), created(STRANGER, { createdAt: Timestamp.fromMillis(0) })),
    );
  });

  it('refuse d’écraser un espace existant d’un autre compte', async () => {
    await assertFails(setDoc(doc(verified(STRANGER), `workspaces/${PERSO_A}`), created(STRANGER)));
  });

  it('un membre modifie nom, réglages, version et découpage, rien d’autre', async () => {
    const db = verified(PARTNER);
    const ref = doc(db, `workspaces/${COMMON}`);
    await assertSucceeds(updateDoc(ref, { name: 'Maison', settings: { kind: 'commun', mode: 'complet' } }));
    await assertSucceeds(updateDoc(ref, { schemaVersion: 11, layout: { transactions: 2 } }));
    await assertFails(updateDoc(ref, { ownerId: PARTNER }));
    await assertFails(updateDoc(ref, { kind: 'perso' }));
    await assertFails(updateDoc(ref, { memberIds: [PARTNER, STRANGER] }));
  });

  it('seul le propriétaire supprime l’espace', async () => {
    await assertFails(deleteDoc(doc(verified(PARTNER), `workspaces/${COMMON}`)));
    await assertFails(deleteDoc(doc(verified(STRANGER), `workspaces/${COMMON}`)));
    await assertSucceeds(deleteDoc(doc(verified(OWNER), `workspaces/${COMMON}`)));
  });

  it('supprime les données puis l’espace dans un même lot', async () => {
    const db = verified(OWNER);
    const batch = writeBatch(db);
    batch.delete(doc(db, `workspaces/${COMMON}/data/transactions__0`));
    batch.delete(doc(db, `workspaces/${COMMON}`));
    await assertSucceeds(batch.commit());
  });
});

describe('invitation', () => {
  beforeEach(() => seedBase());

  const create = (db: Firestore, overrides: Record<string, unknown> = {}, token = TOKEN) =>
    setDoc(doc(db, `invitations/${token}`), {
      ...invitationDoc({ createdAt: serverTimestamp() }),
      ...overrides,
    });

  it('le propriétaire d’un commun sans invité crée une invitation de 7 jours au plus', async () => {
    await assertSucceeds(create(verified(OWNER)));
  });

  it('refuse une invitation trop longue, déjà utilisée, sur un perso ou par un autre', async () => {
    const db = verified(OWNER);
    await assertFails(create(db, { expiresAt: Timestamp.fromMillis(Date.now() + 8 * DAY) }));
    await assertFails(create(db, { usedBy: PARTNER }));
    await assertFails(create(db, { workspaceId: PERSO_A }));
    await assertFails(create(db, {}, 'court'));
    await assertFails(create(verified(PARTNER), { ownerId: PARTNER }));
    await assertFails(create(verified(STRANGER), { ownerId: OWNER }));
  });

  it('refuse une invitation sur un commun qui a déjà un invité', async () => {
    await seed({ [`workspaces/${COMMON}`]: workspaceDoc(OWNER, 'commun', [OWNER, PARTNER]) });
    await assertFails(create(verified(OWNER)));
  });

  it('se lit avec le lien mais ne s’énumère pas', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertSucceeds(getDoc(doc(verified(PARTNER), `invitations/${TOKEN}`)));
    await assertFails(getDocs(collection(verified(PARTNER), 'invitations')));
    await assertFails(getDoc(doc(unverified(UNVERIFIED), `invitations/${TOKEN}`)));
    await assertSucceeds(
      getDocs(query(collection(verified(OWNER), 'invitations'), where('ownerId', '==', OWNER))),
    );
  });

  it('B accepte l’invitation et accède au commun', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertSucceeds(accept(verified(PARTNER), PARTNER));
    await assertSucceeds(getDoc(doc(verified(PARTNER), `workspaces/${COMMON}/data/transactions__0`)));
  });

  it('une invitation déjà utilisée ne sert pas une deuxième fois', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertSucceeds(accept(verified(PARTNER), PARTNER));
    await assertFails(accept(verified(STRANGER), STRANGER, TOKEN, COMMON, [OWNER, PARTNER, STRANGER]));
    await assertFails(accept(verified(STRANGER), STRANGER));
  });

  it('une invitation expirée est refusée', async () => {
    await seed({
      [`invitations/${TOKEN}`]: invitationDoc({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) }),
    });
    await assertFails(accept(verified(PARTNER), PARTNER));
  });

  it('refuse l’acceptation sans adresse confirmée', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertFails(accept(unverified(UNVERIFIED), UNVERIFIED));
  });

  it('refuse de rejoindre sans invitation, avec celle d’un autre espace ou un seul côté du lot', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc({ workspaceId: 'autre-commun' }) });
    const db = verified(STRANGER);
    await assertFails(updateDoc(doc(db, `workspaces/${COMMON}`), { memberIds: [OWNER, STRANGER] }));
    await assertFails(accept(db, STRANGER));
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertFails(
      updateDoc(doc(db, `workspaces/${COMMON}`), { memberIds: [OWNER, STRANGER], lastInvitation: TOKEN }),
    );
    await assertFails(
      updateDoc(doc(db, `invitations/${TOKEN}`), { usedBy: STRANGER, usedAt: serverTimestamp() }),
    );
  });

  it('le propriétaire ne s’invite pas lui-même', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertFails(accept(verified(OWNER), OWNER, TOKEN, COMMON, [OWNER, OWNER]));
  });

  it('le propriétaire annule l’invitation ; l’invité qui l’a utilisée peut l’effacer', async () => {
    await seed({ [`invitations/${TOKEN}`]: invitationDoc() });
    await assertFails(deleteDoc(doc(verified(STRANGER), `invitations/${TOKEN}`)));
    await assertSucceeds(deleteDoc(doc(verified(OWNER), `invitations/${TOKEN}`)));
    await seed({ [`invitations/${TOKEN}`]: invitationDoc({ usedBy: PARTNER, usedAt: Timestamp.now() }) });
    await assertSucceeds(
      getDocs(query(collection(verified(PARTNER), 'invitations'), where('usedBy', '==', PARTNER))),
    );
    await assertSucceeds(deleteDoc(doc(verified(PARTNER), `invitations/${TOKEN}`)));
  });
});

describe('fin du partage', () => {
  beforeEach(seedShared);

  it('le propriétaire révoque l’accès : B perd l’espace commun', async () => {
    await assertSucceeds(updateDoc(doc(verified(OWNER), `workspaces/${COMMON}`), { memberIds: [OWNER] }));
    await assertFails(getDoc(doc(verified(PARTNER), `workspaces/${COMMON}`)));
    await assertFails(getDoc(doc(verified(PARTNER), `workspaces/${COMMON}/data/transactions__0`)));
  });

  it('l’invité quitte l’espace, sans pouvoir en exclure le propriétaire', async () => {
    const ref = doc(verified(PARTNER), `workspaces/${COMMON}`);
    await assertFails(updateDoc(ref, { memberIds: [PARTNER] }));
    await assertSucceeds(updateDoc(ref, { memberIds: [OWNER] }));
  });

  it('le propriétaire transfère l’espace à l’invité, seul', async () => {
    const ref = doc(verified(OWNER), `workspaces/${COMMON}`);
    await assertFails(updateDoc(ref, { ownerId: STRANGER, memberIds: [STRANGER] }));
    await assertFails(updateDoc(ref, { ownerId: PARTNER, memberIds: [OWNER, PARTNER] }));
    await assertSucceeds(updateDoc(ref, { ownerId: PARTNER, memberIds: [PARTNER] }));
    await assertFails(getDoc(doc(verified(OWNER), `workspaces/${COMMON}`)));
    await assertSucceeds(getDoc(doc(verified(PARTNER), `workspaces/${COMMON}`)));
  });

  it('l’invité ne transfère pas et C n’intervient pas', async () => {
    await assertFails(
      updateDoc(doc(verified(PARTNER), `workspaces/${COMMON}`), { ownerId: PARTNER, memberIds: [PARTNER] }),
    );
    await assertFails(updateDoc(doc(verified(STRANGER), `workspaces/${COMMON}`), { memberIds: [OWNER] }));
  });
});

describe('chemins non prévus', () => {
  it('refuse tout le reste', async () => {
    await assertFails(setDoc(doc(verified(OWNER), 'users/owner-a'), { name: 'Jean D.' }));
    await assertFails(getDoc(doc(verified(OWNER), 'autre/x')));
  });
});
