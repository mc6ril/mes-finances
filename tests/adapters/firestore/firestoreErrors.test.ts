import { toSyncFailure } from '@/adapters/firestore/firestoreErrors';

const firestoreError = (code: string, message = '') =>
  Object.assign(new Error(message), { code, name: 'FirebaseError' });

describe('erreurs de la base en ligne', () => {
  it.each([
    ['permission-denied', 'sync-permission-denied'],
    ['unauthenticated', 'sync-permission-denied'],
    ['unavailable', 'sync-offline'],
    ['resource-exhausted', 'sync-quota-exceeded'],
    ['not-found', 'workspace-not-found'],
    ['internal', 'sync-failed'],
    ['deadline-exceeded', 'sync-offline'],
  ])('traduit %s en %s', (code, expected) => {
    expect(toSyncFailure(firestoreError(code))).toEqual({ ok: false, error: { code: expected } });
  });

  it('reconnaît un document trop volumineux', () => {
    const error = firestoreError(
      'invalid-argument',
      'Document exceeds the maximum allowed size of 1,048,576 bytes',
    );
    expect(toSyncFailure(error).error.code).toBe('sync-document-too-large');
  });

  it('classe toute autre erreur en échec générique', () => {
    expect(toSyncFailure(new Error('boom')).error.code).toBe('sync-failed');
    expect(toSyncFailure('texte').error.code).toBe('sync-failed');
  });
});
