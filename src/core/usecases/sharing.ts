import { canInvite, type Workspace } from '../espaces/workspaces';
import type { PendingInvitationInterface, SharingGatewayInterface } from '../partage/interface';
import { invitationExpiry, invitationStatus, type Invitation, type NewInvitation } from '../partage/model';
import { fail, ok, type Result } from '../shared/errors';

export type SharingPorts = {
  sharing: SharingGatewayInterface;
  pending: PendingInvitationInterface;
  /** Secret du lien : aléatoire, au moins 32 caractères (exigé par les règles). */
  newToken: () => string;
  now: () => Date;
};

export const createSharingUseCases = ({ sharing, pending, newToken, now }: SharingPorts) => {
  /** Lien à usage unique vers un espace commun dont on est propriétaire et encore sans invité. */
  const invite = async (workspace: Workspace): Promise<Result<NewInvitation>> => {
    if (!canInvite(workspace)) {
      return fail('workspace-not-owner');
    }
    if (workspace.shared) {
      return fail('workspace-already-shared');
    }
    const invitation: NewInvitation = {
      token: newToken(),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      expiresAt: invitationExpiry(now()).toISOString(),
    };
    const created = await sharing.createInvitation(invitation);
    if (!created.ok) {
      return created;
    }
    return ok(invitation);
  };

  const pendingInvitations = async (workspace: Workspace): Promise<Result<Invitation[]>> => {
    const listed = await sharing.pendingInvitations(workspace.id);
    if (!listed.ok) {
      return listed;
    }
    return ok(listed.value.filter((invitation) => invitationStatus(invitation, now()) === 'valid'));
  };

  /** Invitation encore utilisable par l'utilisateur connecté. */
  const readInvitation = async (token: string, userId: string): Promise<Result<Invitation>> => {
    const read = await sharing.readInvitation(token);
    if (!read.ok) {
      return read;
    }
    const invitation = read.value;
    if (!invitation) {
      return fail('invitation-not-found');
    }
    if (invitation.ownerId === userId) {
      return fail('invitation-own-workspace');
    }
    const status = invitationStatus(invitation, now());
    if (status === 'used') {
      return fail('invitation-used');
    }
    if (status === 'expired') {
      return fail('invitation-expired');
    }
    return ok(invitation);
  };

  /** Rejoint l'espace ; renvoie son identifiant pour l'ouvrir dès qu'il apparaît dans la liste. */
  const accept = async (token: string, userId: string): Promise<Result<string>> => {
    const invitation = await readInvitation(token, userId);
    if (!invitation.ok) {
      return invitation;
    }
    const accepted = await sharing.acceptInvitation(invitation.value);
    if (!accepted.ok) {
      return accepted;
    }
    return ok(invitation.value.workspaceId);
  };

  const cancel = (token: string): Promise<Result<void>> => sharing.cancelInvitation(token);

  const revoke = async (workspace: Workspace): Promise<Result<void>> => {
    if (workspace.role !== 'owner') {
      return fail('workspace-not-owner');
    }
    if (!workspace.shared) {
      return fail('workspace-not-shared');
    }
    return sharing.revokeGuest(workspace.id);
  };

  const leave = async (workspace: Workspace): Promise<Result<void>> => {
    if (workspace.role === 'owner') {
      return fail('workspace-owner-cannot-leave');
    }
    return sharing.leaveWorkspace(workspace.id);
  };

  const rememberInvitation = (token: string): void => pending.remember(token);

  const takePendingInvitation = (): string | null => pending.take();

  return {
    invite,
    pendingInvitations,
    readInvitation,
    accept,
    cancel,
    revoke,
    leave,
    rememberInvitation,
    takePendingInvitation,
  };
};

export type SharingUseCases = ReturnType<typeof createSharingUseCases>;
