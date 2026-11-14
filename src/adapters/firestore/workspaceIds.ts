import { DEFAULT_WORKSPACE } from '@/core/espaces/workspaces';

/** L'espace principal (« perso » côté application) est un document propre à chaque utilisateur. */
const mainDocumentId = (userId: string): string => `${DEFAULT_WORKSPACE.id}-${userId}`;

export const toDocumentId = (workspaceId: string, userId: string): string =>
  workspaceId === DEFAULT_WORKSPACE.id ? mainDocumentId(userId) : workspaceId;

export const toWorkspaceId = (documentId: string, userId: string): string =>
  documentId === mainDocumentId(userId) ? DEFAULT_WORKSPACE.id : documentId;
