import { BACKUP_APP_ID, readBackup } from './backup';
import { fail, ok, type Result } from './errors';
import type { Dataset } from './model';
import { DEFAULT_WORKSPACE, isWorkspace, resolveActiveId, type Workspace } from './workspaces';
import { isArray, isObject, isString } from '@/utils/typeCheck';

export const FULL_BACKUP_KIND = 'complete';

export type WorkspaceData = { workspace: Workspace; dataset: Dataset };

export type FullBackup = {
  app: typeof BACKUP_APP_ID;
  kind: typeof FULL_BACKUP_KIND;
  exportedAt: string;
  activeId: string;
  workspaces: { workspace: Workspace; schemaVersion: number; data: Dataset }[];
};

export type AnyBackupContent =
  | { kind: 'workspace'; dataset: Dataset; workspaceName: string | null }
  | { kind: 'complete'; entries: WorkspaceData[]; activeId: string };

export const createFullBackup = (
  entries: WorkspaceData[],
  activeId: string,
  exportedAt: string,
): FullBackup => ({
  app: BACKUP_APP_ID,
  kind: FULL_BACKUP_KIND,
  exportedAt,
  activeId,
  workspaces: entries.map(({ workspace, dataset }) => ({
    workspace,
    schemaVersion: dataset.schemaVersion,
    data: dataset,
  })),
});

const readEntry = (raw: unknown): Result<WorkspaceData> => {
  if (!isObject(raw) || !isWorkspace(raw.workspace)) {
    return fail('backup-corrupted', { detail: 'workspaces' });
  }
  const read = readBackup({ app: BACKUP_APP_ID, schemaVersion: raw.schemaVersion, data: raw.data });
  if (!read.ok) {
    return fail(read.error.code, { ...read.error, workspaceName: raw.workspace.name });
  }
  return ok({ workspace: raw.workspace, dataset: read.value.dataset });
};

const readFullBackup = (raw: Record<string, unknown>): Result<AnyBackupContent> => {
  if (!isArray(raw.workspaces)) {
    return fail('backup-corrupted', { detail: 'workspaces' });
  }
  const entries: WorkspaceData[] = [];
  for (const item of raw.workspaces) {
    const entry = readEntry(item);
    if (!entry.ok) {
      return entry;
    }
    if (entries.some((existing) => existing.workspace.id === entry.value.workspace.id)) {
      return fail('backup-corrupted', { detail: 'workspaces' });
    }
    entries.push(entry.value);
  }
  if (!entries.some((entry) => entry.workspace.id === DEFAULT_WORKSPACE.id)) {
    return fail('backup-missing-main');
  }
  const workspaces = entries.map((entry) => entry.workspace);
  return ok({
    kind: 'complete',
    entries,
    activeId: resolveActiveId(workspaces, isString(raw.activeId) ? raw.activeId : null),
  });
};

export const readAnyBackup = (raw: unknown): Result<AnyBackupContent> => {
  if (isObject(raw) && raw.app === BACKUP_APP_ID && raw.kind === FULL_BACKUP_KIND) {
    return readFullBackup(raw);
  }
  const single = readBackup(raw);
  if (!single.ok) {
    return single;
  }
  return ok({ kind: 'workspace', ...single.value });
};
