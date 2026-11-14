import type { AuditAction, CollectionName, Dataset, Settings } from '../shared/model';
import type { Result } from '../shared/errors';

export type CollectionItem<C extends CollectionName> = Dataset[C][number];

/** Persistance d'un espace de suivi (une base par espace). */
export interface FinanceRepositoryInterface {
  load(): Promise<Result<Dataset | null>>;
  saveSettings(settings: Settings): Promise<Result<void>>;
  put<C extends CollectionName>(collection: C, items: CollectionItem<C>[]): Promise<Result<void>>;
  remove(collection: CollectionName, keys: string[]): Promise<Result<void>>;
  replaceAll(dataset: Dataset): Promise<Result<void>>;
  destroy(): Promise<Result<void>>;
  close(): Promise<void>;
}

export type AuditLog = { action: AuditAction; entity: string; summary: string };

/** Accès des cas d'usage aux données de l'espace actif, chaque écriture étant journalisée. */
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
