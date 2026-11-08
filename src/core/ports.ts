import type { CollectionName, Dataset, Settings } from './model';
import type { Result } from './errors';
import type { Workspace, WorkspaceRegistryState } from './workspaces';

export type CollectionItem<C extends CollectionName> = Dataset[C][number];

export interface FinanceRepositoryInterface {
  load(): Promise<Result<Dataset | null>>;
  saveSettings(settings: Settings): Promise<Result<void>>;
  put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<Result<void>>;
  remove(collection: CollectionName, keys: string[]): Promise<Result<void>>;
  replaceAll(dataset: Dataset): Promise<Result<void>>;
  destroy(): Promise<Result<void>>;
  close(): Promise<void>;
}

export interface WorkspaceRegistryInterface {
  load(): Promise<WorkspaceRegistryState>;
  save(workspaces: Workspace[], activeId: string): void;
}
