import { fail } from '@/core/shared/errors';
import { AuthSession } from '@/core/store/AuthSession';
import { aUser, fakeAuthGateway } from '../usecases/fakeAuthGateway';

describe('session d’authentification', () => {
  it('vérifie la session tant que le fournisseur n’a pas répondu', () => {
    const { gateway } = fakeAuthGateway();
    const session = new AuthSession(gateway);
    session.start();
    expect(session.getSnapshot()).toEqual({ status: 'checking', user: null, error: null });
  });

  it('passe connecté puis déconnecté au gré du fournisseur et prévient les abonnés', () => {
    const { gateway, emit } = fakeAuthGateway();
    const session = new AuthSession(gateway);
    const listener = vi.fn();
    session.subscribe(listener);
    session.start();

    emit(aUser());
    expect(session.getSnapshot()).toEqual({ status: 'signed-in', user: aUser(), error: null });

    emit(null);
    expect(session.getSnapshot()).toEqual({ status: 'signed-out', user: null, error: null });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ne s’abonne qu’une fois au fournisseur et se désabonne à l’arrêt', () => {
    const { gateway, listenerCount } = fakeAuthGateway();
    const session = new AuthSession(gateway);
    session.start();
    session.start();
    expect(listenerCount()).toBe(1);
    session.stop();
    expect(listenerCount()).toBe(0);
  });

  it('garde le prénom saisi à l’inscription même si le fournisseur notifie avant la mise à jour du profil', async () => {
    const { gateway, emit } = fakeAuthGateway();
    const session = new AuthSession(gateway);
    session.start();
    emit(aUser({ displayName: null }));
    await session.signUp({ displayName: 'Camille', email: 'camille@example.com', password: 'motdepasse' });
    expect(session.getSnapshot().user?.displayName).toBe('Camille');
  });

  it('ne change pas d’état quand une connexion échoue', async () => {
    const { gateway, emit } = fakeAuthGateway({ signIn: fail('auth-invalid-credentials') });
    const session = new AuthSession(gateway);
    session.start();
    emit(null);
    const result = await session.signIn('jean@example.com', 'faux');
    expect(result).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
    expect(session.getSnapshot().status).toBe('signed-out');
  });

  describe('sans fournisseur configuré', () => {
    it('est indisponible au démarrage', () => {
      const session = new AuthSession(null);
      session.start();
      expect(session.getSnapshot()).toEqual({
        status: 'unavailable',
        user: null,
        error: { code: 'auth-not-configured' },
      });
    });

    it('refuse toute opération', async () => {
      const session = new AuthSession(null);
      const notConfigured = { ok: false, error: { code: 'auth-not-configured' } };
      expect(await session.signIn('jean@example.com', 'secret')).toEqual(notConfigured);
      expect(await session.signInWithGoogle()).toEqual(notConfigured);
      expect(await session.signOut()).toEqual(notConfigured);
      expect(await session.sendPasswordReset('jean@example.com')).toEqual(notConfigured);
    });
  });
});
