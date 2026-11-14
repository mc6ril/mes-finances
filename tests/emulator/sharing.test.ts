import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { FirestoreSharing } from '@/adapters/firestore/FirestoreSharing';
import { FirestoreWorkspaceRegistry } from '@/adapters/firestore/FirestoreWorkspaceRegistry';
import { SyncMonitor } from '@/adapters/firestore/SyncMonitor';
import { randomToken } from '@/adapters/ids/randomToken';
import { invitationExpiry } from '@/core/partage/model';

/** Partage par invitation : A invite B dans son commun ; C est un autre compte. */
const A = 'owner-a';
const B = 'partner-b';
const C = 'stranger-c';
const COMMON = 'commun-ab';

let env: RulesTestEnvironment;

const dbOf = (uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;

const sharingOf = (uid: string) => {
  const monitor = new SyncMonitor();
  return { sharing: new FirestoreSharing(dbOf(uid), uid, monitor), monitor };
};

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

const membersOf = async (workspaceId: string): Promise<string[]> => {
  let members: string[] = [];
  await env.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(context.firestore() as unknown as Firestore, `workspaces/${workspaceId}`),
    );
    members = (snapshot.data()?.memberIds as string[]) ?? [];
  });
  return members;
};

const newInvitation = (token = randomToken()) => ({
  token,
  workspaceId: COMMON,
  workspaceName: 'Commun',
  expiresAt: invitationExpiry(new Date()).toISOString(),
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances-sharing',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, `workspaces/${COMMON}`), {
      ownerId: A,
      memberIds: [A],
      kind: 'commun',
      name: 'Commun',
      createdAt: Timestamp.now(),
    });
  });
});

describe('invitation par lien', () => {
  it('A invite, B accepte et voit l’espace commun comme invité', async () => {
    const owner = sharingOf(A);
    const invitation = newInvitation();
    expect(await owner.sharing.createInvitation(invitation)).toEqual({ ok: true, value: undefined });

    const read = await sharingOf(B).sharing.readInvitation(invitation.token);
    expect(read).toEqual({
      ok: true,
      value: { ...invitation, ownerId: A, usedBy: null },
    });
    const guest = sharingOf(B);
    expect(await guest.sharing.acceptInvitation(read.ok ? read.value! : (null as never))).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await membersOf(COMMON)).toEqual([A, B]);
    const listed = await new FirestoreWorkspaceRegistry(dbOf(B), B, guest.monitor, storage()).load();
    expect(listed.ok && listed.value.workspaces.find((item) => item.id === COMMON)).toEqual({
      id: COMMON,
      name: 'Commun',
      kind: 'commun',
      role: 'guest',
      shared: true,
    });
    await guest.monitor.flush(5000);
    // Consommée, l'invitation est effacée : le lien ne mène plus nulle part.
    expect(await sharingOf(C).sharing.readInvitation(invitation.token)).toEqual({ ok: true, value: null });
  });

  it('un lien inconnu ne renvoie rien', async () => {
    expect(await sharingOf(B).sharing.readInvitation(randomToken())).toEqual({ ok: true, value: null });
  });

  it('une invitation déjà utilisée est refusée à un autre compte', async () => {
    const invitation = newInvitation();
    await sharingOf(A).sharing.createInvitation(invitation);
    const read = await sharingOf(B).sharing.readInvitation(invitation.token);
    await sharingOf(B).sharing.acceptInvitation(read.ok ? read.value! : (null as never));
    const stale = { ...invitation, ownerId: A, usedBy: null };
    expect(await sharingOf(C).sharing.acceptInvitation(stale)).toEqual({
      ok: false,
      error: { code: 'invitation-used' },
    });
    expect(await membersOf(COMMON)).toEqual([A, B]);
  });

  it('efface les invitations expirées quand le propriétaire liste les siennes', async () => {
    const expired = randomToken();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, `invitations/${expired}`), {
        workspaceId: COMMON,
        ownerId: A,
        workspaceName: 'Commun',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() - 1000),
        usedBy: null,
        usedAt: null,
      });
    });
    const owner = sharingOf(A);
    expect(await owner.sharing.pendingInvitations(COMMON)).toEqual({ ok: true, value: [] });
    await owner.monitor.flush(5000);
    expect(await sharingOf(B).sharing.readInvitation(expired)).toEqual({ ok: true, value: null });
  });

  it('liste puis annule les invitations en attente du propriétaire', async () => {
    const owner = sharingOf(A);
    const invitation = newInvitation();
    await owner.sharing.createInvitation(invitation);
    const pending = await owner.sharing.pendingInvitations(COMMON);
    expect(pending.ok && pending.value.map((item) => item.token)).toEqual([invitation.token]);
    expect(await owner.sharing.cancelInvitation(invitation.token)).toEqual({ ok: true, value: undefined });
    await owner.monitor.flush(5000);
    expect(await sharingOf(B).sharing.readInvitation(invitation.token)).toEqual({ ok: true, value: null });
  });

  it('A retire l’accès de B ; B peut aussi quitter de lui-même', async () => {
    const invitation = newInvitation();
    await sharingOf(A).sharing.createInvitation(invitation);
    const read = await sharingOf(B).sharing.readInvitation(invitation.token);
    await sharingOf(B).sharing.acceptInvitation(read.ok ? read.value! : (null as never));

    const owner = sharingOf(A);
    expect(await owner.sharing.revokeGuest(COMMON)).toEqual({ ok: true, value: undefined });
    await owner.monitor.flush(5000);
    expect(await membersOf(COMMON)).toEqual([A]);

    const second = newInvitation();
    await sharingOf(A).sharing.createInvitation(second);
    const again = await sharingOf(B).sharing.readInvitation(second.token);
    await sharingOf(B).sharing.acceptInvitation(again.ok ? again.value! : (null as never));
    const guest = sharingOf(B);
    expect(await guest.sharing.leaveWorkspace(COMMON)).toEqual({ ok: true, value: undefined });
    await guest.monitor.flush(5000);
    expect(await membersOf(COMMON)).toEqual([A]);
  });

  it('crée des liens aléatoires assez longs pour les règles', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
    tokens.forEach((token) => expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/));
  });
});
