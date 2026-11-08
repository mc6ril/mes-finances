import { BACKUP_APP_ID, readBackup } from './backup';
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

export type AnyBackupReadResult =
  | { ok: true; kind: 'workspace'; dataset: Dataset; workspaceName: string | null }
  | { ok: true; kind: 'complete'; entries: WorkspaceData[]; activeId: string }
  | { ok: false; reason: string };

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

const fail = (reason: string): AnyBackupReadResult => ({ ok: false, reason });

const readEntry = (raw: unknown): WorkspaceData | string => {
  if (!isObject(raw) || !isWorkspace(raw.workspace)) {
    return 'La sauvegarde est corrompue (espace invalide).';
  }
  const read = readBackup({ app: BACKUP_APP_ID, schemaVersion: raw.schemaVersion, data: raw.data });
  if (!read.ok) {
    return `Espace « ${raw.workspace.name} » : ${read.reason}`;
  }
  return { workspace: raw.workspace, dataset: read.dataset };
};

const readFullBackup = (raw: Record<string, unknown>): AnyBackupReadResult => {
  if (!isArray(raw.workspaces)) {
    return fail('La sauvegarde est corrompue (liste des espaces invalide).');
  }
  const entries: WorkspaceData[] = [];
  for (const item of raw.workspaces) {
    const entry = readEntry(item);
    if (isString(entry)) {
      return fail(entry);
    }
    if (entries.some((existing) => existing.workspace.id === entry.workspace.id)) {
      return fail('La sauvegarde est corrompue (espace en double).');
    }
    entries.push(entry);
  }
  if (!entries.some((entry) => entry.workspace.id === DEFAULT_WORKSPACE.id)) {
    return fail('La sauvegarde ne contient pas l’espace principal.');
  }
  const workspaces = entries.map((entry) => entry.workspace);
  return {
    ok: true,
    kind: 'complete',
    entries,
    activeId: resolveActiveId(workspaces, isString(raw.activeId) ? raw.activeId : null),
  };
};

export const readAnyBackup = (raw: unknown): AnyBackupReadResult => {
  if (isObject(raw) && raw.app === BACKUP_APP_ID && raw.kind === FULL_BACKUP_KIND) {
    return readFullBackup(raw);
  }
  const single = readBackup(raw);
  if (!single.ok) {
    return single;
  }
  return { ok: true, kind: 'workspace', dataset: single.dataset, workspaceName: single.workspaceName };
};
