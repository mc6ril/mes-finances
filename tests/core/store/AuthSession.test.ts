import { fail, ok } from '@/core/shared/errors';
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

  describe('adresse e-mail non confirmée', () => {
    it('met la session en attente de confirmation', () => {
      const { gateway, emit } = fakeAuthGateway();
      const session = new AuthSession(gateway);
      session.start();
      emit(aUser({ emailVerified: false }));
      expect(session.getSnapshot()).toEqual({
        status: 'unverified',
        user: aUser({ emailVerified: false }),
        error: null,
      });
    });

    it('attend la confirmation juste après une inscription par e-mail', async () => {
      const { gateway } = fakeAuthGateway({ signUp: ok(aUser({ emailVerified: false })) });
      const session = new AuthSession(gateway);
      session.start();
      await session.signUp({ displayName: 'Jean', email: 'jean.d@example.com', password: 'motdepasse' });
      expect(session.getSnapshot().status).toBe('unverified');
    });

    it('passe connecté quand le rechargement indique l’adresse confirmée', async () => {
      const { gateway, emit } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: true })) });
      const session = new AuthSession(gateway);
      session.start();
      emit(aUser({ emailVerified: false }));
      await session.reloadUser();
      expect(session.getSnapshot().status).toBe('signed-in');
    });

    it('ne recharge l’utilisateur au retour sur l’onglet que s’il attend une confirmation', async () => {
      const { gateway, emit, calls } = fakeAuthGateway();
      const session = new AuthSession(gateway);
      session.start();
      emit(aUser({ emailVerified: true }));
      await session.refresh();
      expect(calls).toEqual([]);
      emit(aUser({ emailVerified: false }));
      await session.refresh();
      expect(calls).toEqual([{ kind: 'reloadUser' }]);
    });
  });

  describe('suppression du compte', () => {
    it('déconnecte une fois le compte supprimé', async () => {
      const { gateway, emit } = fakeAuthGateway();
      const session = new AuthSession(gateway);
      session.start();
      emit(aUser());
      await session.deleteAccount({ method: 'google' });
      expect(session.getSnapshot()).toEqual({ status: 'signed-out', user: null, error: null });
    });

    it('reste connecté si la suppression échoue', async () => {
      const { gateway, emit } = fakeAuthGateway({ deleteAccount: fail('auth-invalid-credentials') });
      const session = new AuthSession(gateway);
      session.start();
      emit(aUser());
      await session.deleteAccount({ method: 'password', password: 'faux' });
      expect(session.getSnapshot().status).toBe('signed-in');
    });
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
      expect(await session.reloadUser()).toEqual(notConfigured);
      expect(await session.deleteAccount({ method: 'google' })).toEqual(notConfigured);
    });
  });
});
