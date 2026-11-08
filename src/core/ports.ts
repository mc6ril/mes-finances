import type { CollectionName, Dataset, Settings } from './model';
import type { Result } from './errors';
import type { WorkspaceData } from './fullBackup';
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

export type UserFile = { readonly name: string };

export type SavedFile = { name: string; content: string; mimeType: string };

export interface TextFileReaderInterface {
  read(file: UserFile): Promise<Result<string>>;
}

export interface CsvParserInterface {
  parse(text: string): Result<string[][]>;
}

export interface JsonParserInterface {
  parse(text: string): Result<unknown>;
}

export interface FileSaverInterface {
  save(file: SavedFile): Result<void>;
}

export interface WorkspaceDataSourceInterface {
  allWorkspaceData(): Promise<Result<WorkspaceData[]>>;
  workspaceData(workspaceId: string): Promise<Result<WorkspaceData | null>>;
  markShared(workspaceId: string): void;
}
