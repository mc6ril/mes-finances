import type { AuditAction, CollectionName, Dataset, Settings } from './model';
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
  save(workspaces: Workspace[], activeId: string): Result<void>;
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
  markShared(workspaceId: string): Result<void>;
}

export type AuditLog = { action: AuditAction; entity: string; summary: string };

export interface FinanceGatewayInterface {
  currentDataset(): Dataset | null;
  upsert<C extends CollectionName>(
    collection: C,
    items: CollectionItem<C>[],
    log: AuditLog,
  ): Promise<Result<void>>;
  remove(collection: CollectionName, keys: string[], log: AuditLog): Promise<Result<void>>;
  updateSettings(patch: Partial<Settings>, log: AuditLog | null): Promise<Result<void>>;
  restore(dataset: Dataset, log: AuditLog): Promise<Result<void>>;
}

export type IdGenerator = () => string;

export type Clock = () => Date;
