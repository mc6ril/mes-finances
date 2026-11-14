import { fail, type AppErrorCode, type Failure } from '@/core/shared/errors';

const CODES: Record<string, AppErrorCode> = {
  'permission-denied': 'sync-permission-denied',
  unauthenticated: 'sync-permission-denied',
  unavailable: 'sync-offline',
  'deadline-exceeded': 'sync-offline',
  'resource-exhausted': 'sync-quota-exceeded',
  'not-found': 'workspace-not-found',
};

const codeOf = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : '');

/** Traduit une erreur Firestore en code typé ; le détail technique n'est pas exposé. */
export const toSyncFailure = (error: unknown): Failure => {
  const code = codeOf(error);
  if (code === 'invalid-argument' && /maximum allowed size|too large/i.test(messageOf(error))) {
    return fail('sync-document-too-large');
  }
  return fail((code && CODES[code]) || 'sync-failed');
};
