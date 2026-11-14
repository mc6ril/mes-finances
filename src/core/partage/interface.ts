import type { Result } from '../shared/errors';
import type { Invitation, NewInvitation } from './model';

/** Partage d'un espace commun avec une seule personne, par lien d'invitation. */
export interface SharingGatewayInterface {
  /** Enregistre l'invitation ; n'aboutit qu'une fois confirmée par le serveur (réseau exigé). */
  createInvitation(invitation: NewInvitation): Promise<Result<void>>;
  /** null si le lien ne correspond à aucune invitation. */
  readInvitation(token: string): Promise<Result<Invitation | null>>;
  /** Consomme l'invitation et ajoute l'utilisateur connecté à l'espace, en une seule opération. */
  acceptInvitation(invitation: Invitation): Promise<Result<void>>;
  /** Invitations encore valables créées pour cet espace. */
  pendingInvitations(workspaceId: string): Promise<Result<Invitation[]>>;
  cancelInvitation(token: string): Promise<Result<void>>;
  /** Propriétaire : retire l'accès de la personne invitée. */
  revokeGuest(workspaceId: string): Promise<Result<void>>;
  /** Invité : quitte l'espace. */
  leaveWorkspace(workspaceId: string): Promise<Result<void>>;
}

/** Lien ouvert avant la connexion : gardé le temps de se connecter ou de créer son compte. */
export interface PendingInvitationInterface {
  remember(token: string): void;
  /** Rend le token gardé et l'oublie. */
  take(): string | null;
}
