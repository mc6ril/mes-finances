import { isObject, isString } from '@/utils/typeCheck';

export type WorkspaceSource = 'local' | 'import';

export type Workspace = {
  id: string;
  name: string;
  source: WorkspaceSource;
  importedAt: string | null;
};

export type WorkspaceRegistryState = { workspaces: Workspace[]; activeId: string };

export const DEFAULT_WORKSPACE: Workspace = {
  id: 'perso',
  name: 'Perso',
  source: 'local',
  importedAt: null,
};

export const isReadOnly = (workspace: Workspace): boolean => workspace.source === 'import';

export const normalizeWorkspaceName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export const workspaceNameError = (
  name: string,
  workspaces: Workspace[],
  ignoredId: string | null = null,
): string | null => {
  const normalized = normalizeWorkspaceName(name);
  if (!normalized) {
    return 'Donne un nom à l’espace.';
  }
  const taken = workspaces.some(
    (workspace) =>
      workspace.id !== ignoredId &&
      workspace.name.toLocaleLowerCase('fr') === normalized.toLocaleLowerCase('fr'),
  );
  if (taken) {
    return 'Un espace porte déjà ce nom.';
  }
  return null;
};

export const isWorkspace = (value: unknown): value is Workspace =>
  isObject(value) &&
  isString(value.id) &&
  value.id.length > 0 &&
  isString(value.name) &&
  (value.source === 'local' || value.source === 'import') &&
  (value.importedAt === null || isString(value.importedAt));

export const withDefaultWorkspace = (workspaces: Workspace[]): Workspace[] => {
  const others = workspaces.filter((workspace) => workspace.id !== DEFAULT_WORKSPACE.id);
  const stored = workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE.id);
  return [{ ...DEFAULT_WORKSPACE, name: stored?.name ?? DEFAULT_WORKSPACE.name }, ...others];
};

export const parseWorkspaces = (raw: unknown): Workspace[] => {
  if (!Array.isArray(raw)) {
    return [DEFAULT_WORKSPACE];
  }
  const seen = new Set<string>();
  const valid = raw.filter(isWorkspace).filter((workspace) => {
    if (seen.has(workspace.id)) {
      return false;
    }
    seen.add(workspace.id);
    return true;
  });
  return withDefaultWorkspace(valid);
};

export const resolveActiveId = (workspaces: Workspace[], activeId: string | null): string => {
  if (activeId && workspaces.some((workspace) => workspace.id === activeId)) {
    return activeId;
  }
  return DEFAULT_WORKSPACE.id;
};

export const workspaceFileSlug = (name: string): string =>
  normalizeWorkspaceName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'espace';
