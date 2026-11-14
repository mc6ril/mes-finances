import { fail, ok } from '@/core/shared/errors';
import { createAuthUseCases } from '@/core/usecases/auth';
import { aUser, fakeAuthGateway } from './fakeAuthGateway';

const signUpForm = {
  displayName: 'Camille',
  email: 'Camille.D@example.com',
  password: 'motdepasse',
  confirmation: 'motdepasse',
};

describe('inscription', () => {
  it('crée le compte avec des identifiants nettoyés puis envoie l’e-mail de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).signUp(signUpForm);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      {
        kind: 'signUp',
        credentials: { displayName: 'Camille', email: 'camille.d@example.com', password: 'motdepasse' },
      },
      { kind: 'sendEmailVerification' },
    ]);
  });

  it('n’appelle pas le fournisseur si le formulaire est invalide', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).signUp({ ...signUpForm, confirmation: 'autre' });
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-mismatch' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter un e-mail déjà utilisé sans envoyer de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway({ signUp: fail('auth-email-taken') });
    const result = await createAuthUseCases({ gateway }).signUp(signUpForm);
    expect(result).toEqual({ ok: false, error: { code: 'auth-email-taken' } });
    expect(calls.map((call) => call.kind)).toEqual(['signUp']);
  });

  it('reste réussie si l’e-mail de vérification ne part pas', async () => {
    const { gateway } = fakeAuthGateway({ sendEmailVerification: fail('auth-network') });
    const result = await createAuthUseCases({ gateway }).signUp(signUpForm);
    expect(result).toEqual({
      ok: true,
      value: aUser({ email: 'camille.d@example.com', displayName: 'Camille' }),
    });
  });
});

describe('connexion par e-mail', () => {
  it('se connecte avec l’e-mail normalisé', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).signIn({
      email: ' Jean.D@Example.com ',
      password: 'secret',
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ kind: 'signIn', email: 'jean.d@example.com', password: 'secret' }]);
  });

  it('refuse un mot de passe vide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).signIn({ email: 'jean@example.com', password: '' });
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-empty' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter des identifiants incorrects', async () => {
    const { gateway } = fakeAuthGateway({ signIn: fail('auth-invalid-credentials') });
    const result = await createAuthUseCases({ gateway }).signIn({
      email: 'jean@example.com',
      password: 'faux',
    });
    expect(result).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
  });
});

describe('connexion avec Google', () => {
  it('délègue au fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).signInWithGoogle();
    expect(result).toEqual({ ok: true, value: aUser({ providers: ['google'], emailVerified: true }) });
    expect(calls).toEqual([{ kind: 'signInWithGoogle' }]);
  });

  it('fait remonter une fenêtre fermée par l’utilisateur', async () => {
    const { gateway } = fakeAuthGateway({ signInWithGoogle: fail('auth-cancelled') });
    expect(await createAuthUseCases({ gateway }).signInWithGoogle()).toEqual({
      ok: false,
      error: { code: 'auth-cancelled' },
    });
  });
});

describe('déconnexion', () => {
  it('délègue au fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(await createAuthUseCases({ gateway }).signOut()).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([{ kind: 'signOut' }]);
  });
});

describe('mot de passe oublié', () => {
  it('envoie le lien à l’adresse normalisée', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).requestPasswordReset(' Jean@Example.com ');
    expect(result).toEqual({ ok: true, value: 'jean@example.com' });
    expect(calls).toEqual([{ kind: 'sendPasswordReset', email: 'jean@example.com' }]);
  });

  it('refuse une adresse invalide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).requestPasswordReset('jean');
    expect(result).toEqual({ ok: false, error: { code: 'auth-email-invalid' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter un trop grand nombre de demandes', async () => {
    const { gateway } = fakeAuthGateway({ sendPasswordReset: fail('auth-too-many-requests') });
    expect(await createAuthUseCases({ gateway }).requestPasswordReset('jean@example.com')).toEqual({
      ok: false,
      error: { code: 'auth-too-many-requests' },
    });
  });
});

describe('vérification de l’adresse', () => {
  it('renvoie l’e-mail de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(await createAuthUseCases({ gateway }).resendEmailVerification()).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual([{ kind: 'sendEmailVerification' }]);
  });
});

describe('confirmation de l’adresse e-mail', () => {
  it('réussit quand le fournisseur indique l’adresse confirmée', async () => {
    const { gateway, calls } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: true })) });
    expect(await createAuthUseCases({ gateway }).confirmEmailVerified()).toEqual({
      ok: true,
      value: aUser({ emailVerified: true }),
    });
    expect(calls).toEqual([{ kind: 'reloadUser' }]);
  });

  it('signale une adresse pas encore confirmée', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: false })) });
    expect(await createAuthUseCases({ gateway }).confirmEmailVerified()).toEqual({
      ok: false,
      error: { code: 'auth-email-not-verified' },
    });
  });

  it('échoue sans utilisateur connecté', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: ok(null) });
    expect(await createAuthUseCases({ gateway }).confirmEmailVerified()).toEqual({
      ok: false,
      error: { code: 'auth-failed' },
    });
  });

  it('fait remonter une erreur réseau', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: fail('auth-network') });
    expect(await createAuthUseCases({ gateway }).confirmEmailVerified()).toEqual({
      ok: false,
      error: { code: 'auth-network' },
    });
  });
});

describe('suppression du compte', () => {
  it('supprime après ré-authentification par mot de passe', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).deleteAccount({
      method: 'password',
      password: 'secret',
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([
      { kind: 'deleteAccount', reauthentication: { method: 'password', password: 'secret' } },
    ]);
  });

  it('refuse un mot de passe vide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway }).deleteAccount({ method: 'password', password: '' });
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-empty' } });
    expect(calls).toEqual([]);
  });

  it('supprime après ré-authentification Google', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(await createAuthUseCases({ gateway }).deleteAccount({ method: 'google' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual([{ kind: 'deleteAccount', reauthentication: { method: 'google' } }]);
  });

  it('fait remonter un mauvais mot de passe', async () => {
    const { gateway } = fakeAuthGateway({ deleteAccount: fail('auth-invalid-credentials') });
    expect(
      await createAuthUseCases({ gateway }).deleteAccount({ method: 'password', password: 'faux' }),
    ).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
  });
});
