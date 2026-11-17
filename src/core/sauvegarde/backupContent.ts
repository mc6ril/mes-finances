import { isMainWorkspace, type Workspace } from '../espaces/workspaces';
import { fail, ok, type Result } from '../shared/errors';
import type { Dataset } from '../shared/model';
import type { AnyBackupContent, WorkspaceData } from './fullBackup';

/**
 * Réglages à importer dans l'espace affiché : le fichier d'un seul espace, ou, dans une sauvegarde
 * complète, l'espace principal (si l'espace affiché est le principal) ou l'espace du même identifiant.
 * null quand la sauvegarde complète ne contient pas cet espace.
 */
export const settingsSource = (
  content: AnyBackupContent,
  workspace: Pick<Workspace, 'id'>,
): Dataset | null => {
  if (content.kind === 'workspace') {
    return content.dataset;
  }
  const entry = content.entries.find((item) =>
    isMainWorkspace(workspace) ? isMainWorkspace(item.workspace) : item.workspace.id === workspace.id,
  );
  return entry?.dataset ?? null;
};

export type RestoreRequest = { entries: WorkspaceData[]; activeId: string };

/** Seule une sauvegarde complète se restaure : l'ancien fichier d'un seul espace ne dit pas où aller. */
export const restoreRequest = (content: AnyBackupContent): Result<RestoreRequest> => {
  if (content.kind !== 'complete') {
    return fail('backup-not-complete');
  }
  return ok({ entries: content.entries, activeId: content.activeId });
};
