/** Durée de validité d'un lien d'invitation (vérifiée aussi par les règles de la base). */
export const INVITATION_VALIDITY_DAYS = 7;

/** Marge sous la limite des règles : une horloge d'appareil un peu en avance reste acceptée. */
const CLOCK_MARGIN_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lien à usage unique vers un espace commun ; le token est le secret partagé. */
export type Invitation = {
  token: string;
  workspaceId: string;
  workspaceName: string;
  ownerId: string;
  expiresAt: string;
  usedBy: string | null;
};

export type NewInvitation = Pick<Invitation, 'token' | 'workspaceId' | 'workspaceName' | 'expiresAt'>;

export type InvitationStatus = 'valid' | 'expired' | 'used';

export const invitationExpiry = (now: Date): Date =>
  new Date(now.getTime() + INVITATION_VALIDITY_DAYS * DAY_MS - CLOCK_MARGIN_MS);

export const invitationStatus = (invitation: Invitation, now: Date): InvitationStatus => {
  if (invitation.usedBy) {
    return 'used';
  }
  return now.toISOString() >= invitation.expiresAt ? 'expired' : 'valid';
};
