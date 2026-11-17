import type { Result } from '../shared/errors';
import type { Workspace, WorkspaceRegistryState } from './workspaces';

export type WorkspacesListener = (workspaces: Workspace[]) => void;

/** Espaces accessibles à l'utilisateur et espace actif (mémorisé sur l'appareil). */
export interface WorkspaceRegistryInterface {
  load(): Promise<Result<WorkspaceRegistryState>>;
  /** Changements de la liste venus d'ailleurs : autre appareil, invitation acceptée, accès révoqué. */
  watch(listener: WorkspacesListener): () => void;
  create(workspace: Workspace): Promise<Result<void>>;
  /**
   * Crée plusieurs espaces d'un seul lot, en attendant la réponse du serveur : tout ou rien.
   * Sert à la restauration, qui n'écrit aucune donnée tant que le serveur n'a pas confirmé.
   */
  createAll(workspaces: Workspace[]): Promise<Result<void>>;
  rename(workspaceId: string, name: string): Promise<Result<void>>;
  /** Retire l'espace de la liste ; ses données sont effacées par son dépôt (`destroy`). */
  remove(workspaceId: string): Promise<Result<void>>;
  setActive(workspaceId: string): Result<void>;
}
