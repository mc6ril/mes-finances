import { fail, ok, type Result } from '@/core/shared/errors';
import type { PendingInvitationInterface, SharingGatewayInterface } from '@/core/partage/interface';
import type { Invitation, NewInvitation } from '@/core/partage/model';
import type { Workspace } from '@/core/espaces/workspaces';
import { DEFAULT_WORKSPACE } from '@/core/espaces/workspaces';
import { createSharingUseCases } from '@/core/usecases/sharing';

const NOW = new Date('2026-11-14T10:00:00.000Z');
const TOKEN = 'k3Jd9xQ2mZ7vN4pL8sT1wY6bR0cF5hGa';

const commun: Workspace = { id: 'commun-ab', name: 'Commun', kind: 'commun', role: 'owner' };
const shared: Workspace = { ...commun, shared: true };
const asGuest: Workspace = { ...commun, role: 'guest', shared: true };

const anInvitation = (patch: Partial<Invitation> = {}): Invitation => ({
  token: TOKEN,
  workspaceId: commun.id,
  workspaceName: 'Commun',
  ownerId: 'owner-a',
  expiresAt: '2026-11-21T09:00:00.000Z',
  usedBy: null,
  ...patch,
});

const fakeSharing = (stored: Invitation | null = anInvitation(), answers: { accept?: Result<void> } = {}) => {
  const calls: string[] = [];
  const created: NewInvitation[] = [];
  const sharing: SharingGatewayInterface = {
    createInvitation: async (invitation) => {
      created.push(invitation);
      return ok(undefined);
    },
    readInvitation: async () => ok(stored),
    acceptInvitation: async (invitation) => {
      calls.push(`accept:${invitation.token}`);
      return answers.accept ?? ok(undefined);
    },
    pendingInvitations: async () => ok(stored ? [stored] : []),
    cancelInvitation: async (token) => {
      calls.push(`cancel:${token}`);
      return ok(undefined);
    },
    revokeGuest: async (workspaceId) => {
      calls.push(`revoke:${workspaceId}`);
      return ok(undefined);
    },
    leaveWorkspace: async (workspaceId) => {
      calls.push(`leave:${workspaceId}`);
      return ok(undefined);
    },
  };
  return { sharing, calls, created };
};

const memoryPending = (): PendingInvitationInterface => {
  let token: string | null = null;
  return {
    remember: (value) => {
      token = value;
    },
    take: () => {
      const value = token;
      token = null;
      return value;
    },
  };
};

const setup = (stored?: Invitation | null, answers = {}) => {
  const fake = fakeSharing(stored === undefined ? anInvitation() : stored, answers);
  const useCases = createSharingUseCases({
    sharing: fake.sharing,
    pending: memoryPending(),
    newToken: () => TOKEN,
    now: () => NOW,
  });
  return { ...fake, useCases };
};

describe('inviter dans un espace commun', () => {
  it('crée un lien valable 7 jours au nom de l’espace', async () => {
    const { useCases, created } = setup();
    const result = await useCases.invite(commun);
    expect(result).toMatchObject({ ok: true, value: { token: TOKEN, workspaceId: commun.id } });
    expect(created).toEqual([
      {
        token: TOKEN,
        workspaceId: commun.id,
        workspaceName: 'Commun',
        expiresAt: '2026-11-21T09:00:00.000Z',
      },
    ]);
  });

  it('refuse d’inviter dans un espace perso, d’un autre, ou déjà partagé', async () => {
    const { useCases, created } = setup();
    expect(await useCases.invite(DEFAULT_WORKSPACE)).toEqual(fail('workspace-not-owner'));
    expect(await useCases.invite(asGuest)).toEqual(fail('workspace-not-owner'));
    expect(await useCases.invite(shared)).toEqual(fail('workspace-already-shared'));
    expect(created).toEqual([]);
  });

  it('réutilise l’invitation en attente au lieu d’en créer une autre', async () => {
    const { useCases, created } = setup();
    expect(await useCases.openInvitation(commun)).toMatchObject({ ok: true, value: { token: TOKEN } });
    expect(created).toEqual([]);
  });

  it('ne crée qu’une invitation pour des ouvertures simultanées (double rendu)', async () => {
    const { useCases, created } = setup(null);
    const [first, second] = await Promise.all([
      useCases.openInvitation(commun),
      useCases.openInvitation(commun),
    ]);
    expect(created).toHaveLength(1);
    expect(first).toEqual(second);
    await useCases.openInvitation(commun);
    expect(created).toHaveLength(2);
  });

  it('liste les invitations encore valables', async () => {
    const valid = setup();
    expect(await valid.useCases.pendingInvitations(commun)).toMatchObject({
      ok: true,
      value: [{ token: TOKEN }],
    });
    const expired = setup(anInvitation({ expiresAt: '2026-11-13T10:00:00.000Z' }));
    expect(await expired.useCases.pendingInvitations(commun)).toEqual({ ok: true, value: [] });
  });
});

describe('ouvrir un lien d’invitation', () => {
  it('montre l’invitation valable', async () => {
    const { useCases } = setup();
    expect(await useCases.readInvitation(TOKEN, 'partner-b')).toMatchObject({
      ok: true,
      value: { workspaceName: 'Commun' },
    });
  });

  it.each([
    [null, 'invitation-not-found'],
    [anInvitation({ expiresAt: '2026-11-14T09:59:00.000Z' }), 'invitation-expired'],
    [anInvitation({ usedBy: 'stranger-c' }), 'invitation-used'],
    [anInvitation({ ownerId: 'partner-b' }), 'invitation-own-workspace'],
  ])('refuse un lien inutilisable (%#)', async (stored, code) => {
    const { useCases } = setup(stored);
    expect(await useCases.readInvitation(TOKEN, 'partner-b')).toEqual(fail(code as never));
  });

  it('accepte l’invitation et renvoie l’espace rejoint', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.accept(TOKEN, 'partner-b')).toEqual({ ok: true, value: commun.id });
    expect(calls).toEqual([`accept:${TOKEN}`]);
  });

  it('n’accepte pas une invitation expirée', async () => {
    const { useCases, calls } = setup(anInvitation({ expiresAt: '2026-11-01T00:00:00.000Z' }));
    expect(await useCases.accept(TOKEN, 'partner-b')).toEqual(fail('invitation-expired'));
    expect(calls).toEqual([]);
  });

  it('garde le lien ouvert avant la connexion, une seule fois', () => {
    const { useCases } = setup();
    useCases.rememberInvitation(TOKEN);
    expect(useCases.takePendingInvitation()).toBe(TOKEN);
    expect(useCases.takePendingInvitation()).toBeNull();
  });
});

describe('fin du partage', () => {
  it('le propriétaire retire l’accès de l’invité', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.revoke(shared)).toEqual(ok(undefined));
    expect(calls).toEqual([`revoke:${commun.id}`]);
  });

  it('refuse de retirer un accès sans invité ou sans être propriétaire', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.revoke(commun)).toEqual(fail('workspace-not-shared'));
    expect(await useCases.revoke(asGuest)).toEqual(fail('workspace-not-owner'));
    expect(calls).toEqual([]);
  });

  it('l’invité quitte l’espace ; le propriétaire ne peut pas', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.leave(asGuest)).toEqual(ok(undefined));
    expect(await useCases.leave(shared)).toEqual(fail('workspace-owner-cannot-leave'));
    expect(calls).toEqual([`leave:${commun.id}`]);
  });

  it('annule une invitation en attente', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.cancel(TOKEN)).toEqual(ok(undefined));
    expect(calls).toEqual([`cancel:${TOKEN}`]);
  });
});
