import { fail, ok, type AppErrorCode, type Result } from '../shared/errors';
import type { WorkspaceKind } from '../shared/model';
import { isObject, isString } from '@/core/shared/typeCheck';

/** Propriétaire : a créé l'espace (ou l'a reçu par transfert) ; invité : a rejoint un espace commun. */
export type WorkspaceRole = 'owner' | 'guest';

export type Workspace = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  role: WorkspaceRole;
  /** Espace commun ouvert à une personne invitée (deux membres). */
  shared?: boolean;
};

export type WorkspaceRegistryState = { workspaces: Workspace[]; activeId: string };

/**
 * L'espace principal de chaque compte porte son uid : `perso-<uid>`. Aucun identifiant générique,
 * pour qu'une sauvegarde ne puisse jamais viser l'espace d'un autre compte que celui qui l'a exportée
 * (les règles Firestore n'acceptent un espace perso que sous l'identifiant de son propriétaire).
 */
const MAIN_WORKSPACE_PREFIX = 'perso-';

export const mainWorkspaceId = (userId: string): string => `${MAIN_WORKSPACE_PREFIX}${userId}`;

export const mainWorkspace = (userId: string): Workspace => ({
  id: mainWorkspaceId(userId),
  name: 'Mon espace',
  kind: 'perso',
  role: 'owner',
});

/** Espace principal d'un compte (le sien dans sa liste ; celui de son auteur dans une sauvegarde). */
export const isMainWorkspace = (workspace: Pick<Workspace, 'id'>): boolean =>
  workspace.id.startsWith(MAIN_WORKSPACE_PREFIX);

export type WorkspaceNameError = Extract<AppErrorCode, 'workspace-name-empty' | 'workspace-name-taken'>;

export const normalizeWorkspaceName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export const workspaceNameError = (
  name: string,
  workspaces: Workspace[],
  ignoredId: string | null = null,
): WorkspaceNameError | null => {
  const normalized = normalizeWorkspaceName(name);
  if (!normalized) {
    return 'workspace-name-empty';
  }
  const taken = workspaces.some(
    (workspace) =>
      workspace.id !== ignoredId &&
      workspace.name.toLocaleLowerCase('fr') === normalized.toLocaleLowerCase('fr'),
  );
  if (taken) {
    return 'workspace-name-taken';
  }
  return null;
};

export const resolveActiveId = (workspaces: Workspace[], activeId: string | null): string => {
  if (activeId && workspaces.some((workspace) => workspace.id === activeId)) {
    return activeId;
  }
  return (workspaces.find(isMainWorkspace) ?? workspaces[0])?.id ?? '';
};

/** Espace principal d'abord, puis les autres par nom. */
export const sortWorkspaces = (workspaces: Workspace[]): Workspace[] =>
  [...workspaces].sort((a, b) => {
    if (isMainWorkspace(a) !== isMainWorkspace(b)) {
      return isMainWorkspace(a) ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'fr');
  });

export const canDelete = (workspace: Workspace): boolean =>
  workspace.role === 'owner' && !isMainWorkspace(workspace);

export const canInvite = (workspace: Workspace): boolean =>
  workspace.role === 'owner' && workspace.kind === 'commun';

export const workspaceFileSlug = (name: string): string =>
  normalizeWorkspaceName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'espace';

export const activeIn = (workspaces: Workspace[], activeId: string, main: Workspace): Workspace =>
  workspaces.find((item) => item.id === activeId) ?? workspaces.find(isMainWorkspace) ?? main;

export const newWorkspace = (
  name: string,
  kind: WorkspaceKind,
  workspaces: Workspace[],
  newId: () => string,
): Result<Workspace> => {
  const error = workspaceNameError(name, workspaces);
  if (error) {
    return fail(error);
  }
  return ok({ id: newId(), name: normalizeWorkspaceName(name), kind, role: 'owner' });
};

export const renamedWorkspaces = (
  workspaces: Workspace[],
  workspaceId: string,
  name: string,
): Result<Workspace[]> => {
  const error = workspaceNameError(name, workspaces, workspaceId);
  if (error) {
    return fail(error);
  }
  return ok(
    workspaces.map((item) =>
      item.id === workspaceId ? { ...item, name: normalizeWorkspaceName(name) } : item,
    ),
  );
};

/**
 * Espace décrit dans une sauvegarde (ancien format avec source et dates d'import compris).
 * La nature vient des réglages de l'espace ; on redevient propriétaire de ce qu'on restaure.
 */
export const readWorkspace = (raw: unknown, kind: WorkspaceKind): Workspace | null => {
  if (!isObject(raw) || !isString(raw.id) || raw.id.length === 0 || !isString(raw.name)) {
    return null;
  }
  return { id: raw.id, name: raw.name, kind, role: 'owner' };
};
