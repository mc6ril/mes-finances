import type { CollectionName, Dataset, Settings } from './model';
import type { Workspace, WorkspaceRegistryState } from './workspaces';

export type PortFailureKind = 'indisponible' | 'quota' | 'lecture' | 'format' | 'invalide' | 'inconnu';

export type PortFailure = { ok: false; kind: PortFailureKind; message: string };

export type PortResult<T> = { ok: true; value: T } | PortFailure;

export const success = <T>(value: T): PortResult<T> => ({ ok: true, value });

export const failure = (kind: PortFailureKind, message: string): PortFailure => ({
  ok: false,
  kind,
  message,
});

export type CollectionItem<C extends CollectionName> = Dataset[C][number];

export interface FinanceRepositoryInterface {
  load(): Promise<PortResult<Dataset | null>>;
  saveSettings(settings: Settings): Promise<PortResult<void>>;
  put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<PortResult<void>>;
  remove(collection: CollectionName, keys: string[]): Promise<PortResult<void>>;
  replaceAll(dataset: Dataset): Promise<PortResult<void>>;
  destroy(): Promise<PortResult<void>>;
  close(): Promise<void>;
}

export interface WorkspaceRegistryInterface {
  load(): Promise<WorkspaceRegistryState>;
  save(workspaces: Workspace[], activeId: string): void;
}
