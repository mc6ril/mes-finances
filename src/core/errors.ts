export const APP_ERROR_CODES = [
  'storage-unavailable',
  'storage-full',
  'storage-failed',
  'file-unreadable',
  'file-save-failed',
  'invalid-json',
  'empty-csv',
  'backup-not-recognized',
  'backup-too-recent',
  'backup-corrupted',
  'backup-missing-main',
  'broker-not-recognized',
  'workspace-name-empty',
  'workspace-name-taken',
  'workspace-not-found',
  'workspace-main-protected',
  'invalid-date',
  'invalid-amount',
  'data-not-loaded',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type AppError = { code: AppErrorCode; detail?: string; workspaceName?: string };

export type Failure = { ok: false; error: AppError };

export type Result<T> = { ok: true; value: T } | Failure;

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (code: AppErrorCode, context: Omit<AppError, 'code'> = {}): Failure => ({
  ok: false,
  error: { code, ...context },
});
