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
  'auth-not-configured',
  'auth-name-empty',
  'auth-email-invalid',
  'auth-password-empty',
  'auth-password-too-short',
  'auth-password-mismatch',
  'auth-invalid-credentials',
  'auth-email-taken',
  'auth-too-many-requests',
  'auth-network',
  'auth-cancelled',
  'auth-popup-blocked',
  'auth-other-provider',
  'auth-user-disabled',
  'auth-provider-disabled',
  'auth-unauthorized-domain',
  'auth-failed',
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
