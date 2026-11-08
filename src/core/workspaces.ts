import { fail, ok, type AppErrorCode, type Result } from './errors';
import { isObject, isString } from '@/utils/typeCheck';

export type WorkspaceSource = 'local' | 'import';

export type Workspace = {
  id: string;
  name: string;
  source: WorkspaceSource;
  importedAt: string | null;
  modifiedAt?: string | null;
  sharedAt?: string | null;
};

export type WorkspaceRegistryState = { workspaces: Workspace[]; activeId: string };

export const DEFAULT_WORKSPACE: Workspace = {
  id: 'perso',
  name: 'Perso',
  source: 'local',
  importedAt: null,
};

export const isShared = (workspace: Workspace): boolean =>
  workspace.source === 'import' || Boolean(workspace.sharedAt);

const latestOf = (dates: (string | null | undefined)[]): string =>
  dates.reduce<string>((latest, date) => (date && date > latest ? date : latest), '');

export const hasUnsentChanges = (workspace: Workspace): boolean => {
  if (!isShared(workspace) || !workspace.modifiedAt) {
    return false;
  }
  return workspace.modifiedAt > latestOf([workspace.importedAt, workspace.sharedAt]);
};

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

export const isWorkspace = (value: unknown): value is Workspace =>
  isObject(value) &&
  isString(value.id) &&
  value.id.length > 0 &&
  isString(value.name) &&
  (value.source === 'local' || value.source === 'import') &&
  (value.importedAt === null || isString(value.importedAt)) &&
  (value.modifiedAt === undefined || value.modifiedAt === null || isString(value.modifiedAt)) &&
  (value.sharedAt === undefined || value.sharedAt === null || isString(value.sharedAt));

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

export type ImportTarget = { kind: 'new'; name: string } | { kind: 'existing'; workspaceId: string };

export const activeIn = (workspaces: Workspace[], activeId: string): Workspace =>
  workspaces.find((item) => item.id === activeId) ?? workspaces[0] ?? DEFAULT_WORKSPACE;

export const replaceWorkspace = (workspaces: Workspace[], updated: Workspace): Workspace[] =>
  workspaces.map((item) => (item.id === updated.id ? updated : item));

export const upsertWorkspace = (workspaces: Workspace[], updated: Workspace): Workspace[] =>
  workspaces.some((item) => item.id === updated.id)
    ? replaceWorkspace(workspaces, updated)
    : [...workspaces, updated];

export const touchedWorkspace = (workspace: Workspace, now: Date): Workspace => ({
  ...workspace,
  modifiedAt: now.toISOString(),
});

export const sharedWorkspace = (workspace: Workspace, now: Date): Workspace => ({
  ...workspace,
  sharedAt: now.toISOString(),
});

export const newLocalWorkspace = (
  name: string,
  workspaces: Workspace[],
  newId: () => string,
): Result<Workspace> => {
  const error = workspaceNameError(name, workspaces);
  if (error) {
    return fail(error);
  }
  return ok({ id: newId(), name: normalizeWorkspaceName(name), source: 'local', importedAt: null });
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

export const importedWorkspace = (
  target: ImportTarget,
  workspaces: Workspace[],
  now: Date,
  newId: () => string,
): Result<Workspace> => {
  const importedAt = now.toISOString();
  if (target.kind === 'existing') {
    const existing = workspaces.find((item) => item.id === target.workspaceId);
    if (!existing) {
      return fail('workspace-not-found');
    }
    if (existing.id === DEFAULT_WORKSPACE.id) {
      return fail('workspace-main-protected');
    }
    return ok({ ...existing, source: 'import', importedAt, modifiedAt: null });
  }
  const error = workspaceNameError(target.name, workspaces);
  if (error) {
    return fail(error);
  }
  return ok({
    id: newId(),
    name: normalizeWorkspaceName(target.name),
    source: 'import',
    importedAt,
    modifiedAt: null,
    sharedAt: null,
  });
};
