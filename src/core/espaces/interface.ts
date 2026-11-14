import type { Result } from '../shared/errors';
import type { Workspace, WorkspaceRegistryState } from './workspaces';

/** Liste des espaces de suivi et espace actif. */
export interface WorkspaceRegistryInterface {
  load(): Promise<WorkspaceRegistryState>;
  save(workspaces: Workspace[], activeId: string): Result<void>;
}
