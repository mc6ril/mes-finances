import type { Result } from '../shared/errors';
import type { WorkspaceData } from './fullBackup';

/** Données des espaces à sauvegarder ou partager. */
export interface WorkspaceDataSourceInterface {
  allWorkspaceData(): Promise<Result<WorkspaceData[]>>;
  workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>>;
}
