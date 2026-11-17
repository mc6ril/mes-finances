import { SIGN_OUT_FLUSH_MS } from '@/core/sync/model';
import { fakeSync } from '../sync/fakeSync';
import { fail, ok, type Result } from '@/core/shared/errors';
import { createAuthUseCases } from '@/core/usecases/auth';
import { aUser, fakeAuthGateway } from './fakeAuthGateway';

const noAccountData = { erase: async (): Promise<Result<void>> => ok(undefined) };

const signUpForm = {
  displayName: 'Camille',
  email: 'Camille.D@example.com',
  password: 'motdepasse',
  confirmation: 'motdepasse',
};

describe('inscription', () => {
  it('crée le compte avec des identifiants nettoyés puis envoie l’e-mail de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signUp(
      signUpForm,
    );
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
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signUp(
      {
        ...signUpForm,
        confirmation: 'autre',
      },
    );
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-mismatch' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter un e-mail déjà utilisé sans envoyer de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway({ signUp: fail('auth-email-taken') });
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signUp(
      signUpForm,
    );
    expect(result).toEqual({ ok: false, error: { code: 'auth-email-taken' } });
    expect(calls.map((call) => call.kind)).toEqual(['signUp']);
  });

  it('reste réussie si l’e-mail de vérification ne part pas', async () => {
    const { gateway } = fakeAuthGateway({ sendEmailVerification: fail('auth-network') });
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signUp(
      signUpForm,
    );
    expect(result).toEqual({
      ok: true,
      value: aUser({ email: 'camille.d@example.com', displayName: 'Camille' }),
    });
  });
});

describe('connexion par e-mail', () => {
  it('se connecte avec l’e-mail normalisé', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signIn(
      {
        email: ' Jean.D@Example.com ',
        password: 'secret',
      },
    );
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ kind: 'signIn', email: 'jean.d@example.com', password: 'secret' }]);
  });

  it('refuse un mot de passe vide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signIn(
      {
        email: 'jean@example.com',
        password: '',
      },
    );
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-empty' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter des identifiants incorrects', async () => {
    const { gateway } = fakeAuthGateway({ signIn: fail('auth-invalid-credentials') });
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signIn(
      {
        email: 'jean@example.com',
        password: 'faux',
      },
    );
    expect(result).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
  });
});

describe('connexion avec Google', () => {
  it('délègue au fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({
      gateway,
      sync: fakeSync(),
      accountData: noAccountData,
    }).signInWithGoogle();
    expect(result).toEqual({ ok: true, value: aUser({ providers: ['google'], emailVerified: true }) });
    expect(calls).toEqual([{ kind: 'signInWithGoogle' }]);
  });

  it('fait remonter une fenêtre fermée par l’utilisateur', async () => {
    const { gateway } = fakeAuthGateway({ signInWithGoogle: fail('auth-cancelled') });
    expect(
      await createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData }).signInWithGoogle(),
    ).toEqual({
      ok: false,
      error: { code: 'auth-cancelled' },
    });
  });
});

describe('déconnexion', () => {
  it('attend l’envoi des modifications puis délègue au fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const sync = fakeSync();
    expect(await createAuthUseCases({ gateway, sync, accountData: noAccountData }).signOut()).toEqual({
      ok: true,
      value: undefined,
    });
    expect(sync.flushes).toEqual([SIGN_OUT_FLUSH_MS]);
    expect(calls).toEqual([{ kind: 'signOut' }]);
  });

  it('reste connecté tant que des modifications ne sont pas envoyées', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(
      await createAuthUseCases({ gateway, sync: fakeSync(true), accountData: noAccountData }).signOut(),
    ).toEqual({
      ok: false,
      error: { code: 'sync-pending-writes' },
    });
    expect(calls).toEqual([]);
  });
});

describe('mot de passe oublié', () => {
  it('envoie le lien à l’adresse normalisée', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({
      gateway,
      sync: fakeSync(),
      accountData: noAccountData,
    }).requestPasswordReset(' Jean@Example.com ');
    expect(result).toEqual({ ok: true, value: 'jean@example.com' });
    expect(calls).toEqual([{ kind: 'sendPasswordReset', email: 'jean@example.com' }]);
  });

  it('refuse une adresse invalide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const result = await createAuthUseCases({
      gateway,
      sync: fakeSync(),
      accountData: noAccountData,
    }).requestPasswordReset('jean');
    expect(result).toEqual({ ok: false, error: { code: 'auth-email-invalid' } });
    expect(calls).toEqual([]);
  });

  it('fait remonter un trop grand nombre de demandes', async () => {
    const { gateway } = fakeAuthGateway({ sendPasswordReset: fail('auth-too-many-requests') });
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).requestPasswordReset('jean@example.com'),
    ).toEqual({
      ok: false,
      error: { code: 'auth-too-many-requests' },
    });
  });
});

describe('vérification de l’adresse', () => {
  it('renvoie l’e-mail de vérification', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).resendEmailVerification(),
    ).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual([{ kind: 'sendEmailVerification' }]);
  });
});

describe('confirmation de l’adresse e-mail', () => {
  it('réussit quand le fournisseur indique l’adresse confirmée', async () => {
    const { gateway, calls } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: true })) });
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).confirmEmailVerified(),
    ).toEqual({
      ok: true,
      value: aUser({ emailVerified: true }),
    });
    expect(calls).toEqual([{ kind: 'reloadUser' }]);
  });

  it('signale une adresse pas encore confirmée', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: false })) });
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).confirmEmailVerified(),
    ).toEqual({
      ok: false,
      error: { code: 'auth-email-not-verified' },
    });
  });

  it('échoue sans utilisateur connecté', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: ok(null) });
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).confirmEmailVerified(),
    ).toEqual({
      ok: false,
      error: { code: 'auth-failed' },
    });
  });

  it('fait remonter une erreur réseau', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: fail('auth-network') });
    expect(
      await createAuthUseCases({
        gateway,
        sync: fakeSync(),
        accountData: noAccountData,
      }).confirmEmailVerified(),
    ).toEqual({
      ok: false,
      error: { code: 'auth-network' },
    });
  });
});

describe('suppression du compte', () => {
  const erasing = (result: Result<void> = ok(undefined)) => {
    const log: string[] = [];
    return { log, accountData: { erase: async () => (log.push('erase'), result) } };
  };

  it('ré-authentifie, efface les données en ligne, puis supprime le compte', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const { accountData, log } = erasing();
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData }).deleteAccount({
      method: 'password',
      password: 'secret',
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([
      { kind: 'reauthenticate', reauthentication: { method: 'password', password: 'secret' } },
      { kind: 'deleteAccount' },
    ]);
    expect(log).toEqual(['erase']);
  });

  it('refuse un mot de passe vide sans appeler le fournisseur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const { accountData, log } = erasing();
    const result = await createAuthUseCases({ gateway, sync: fakeSync(), accountData }).deleteAccount({
      method: 'password',
      password: '',
    });
    expect(result).toEqual({ ok: false, error: { code: 'auth-password-empty' } });
    expect(calls).toEqual([]);
    expect(log).toEqual([]);
  });

  it('supprime après ré-authentification Google', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const { accountData } = erasing();
    expect(
      await createAuthUseCases({ gateway, sync: fakeSync(), accountData }).deleteAccount({
        method: 'google',
      }),
    ).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([
      { kind: 'reauthenticate', reauthentication: { method: 'google' } },
      { kind: 'deleteAccount' },
    ]);
  });

  it('n’efface rien si la ré-authentification échoue', async () => {
    const { gateway, calls } = fakeAuthGateway({ reauthenticate: fail('auth-invalid-credentials') });
    const { accountData, log } = erasing();
    expect(
      await createAuthUseCases({ gateway, sync: fakeSync(), accountData }).deleteAccount({
        method: 'password',
        password: 'faux',
      }),
    ).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
    expect(log).toEqual([]);
    expect(calls.map((call) => call.kind)).toEqual(['reauthenticate']);
  });

  it('garde le compte si les données en ligne n’ont pas pu être effacées', async () => {
    const { gateway, calls } = fakeAuthGateway();
    const { accountData } = erasing(fail('sync-offline'));
    expect(
      await createAuthUseCases({ gateway, sync: fakeSync(), accountData }).deleteAccount({
        method: 'google',
      }),
    ).toEqual({ ok: false, error: { code: 'sync-offline' } });
    expect(calls.map((call) => call.kind)).toEqual(['reauthenticate']);
  });
});

const authUseCases = (gateway: ReturnType<typeof fakeAuthGateway>['gateway']) =>
  createAuthUseCases({ gateway, sync: fakeSync(), accountData: noAccountData });

describe('lien de confirmation d’adresse', () => {
  it('applique le code puis relit l’utilisateur connecté, désormais confirmé', async () => {
    const { gateway, calls } = fakeAuthGateway({ reloadUser: ok(aUser({ emailVerified: true })) });
    expect(await authUseCases(gateway).confirmEmail('CODE')).toEqual(ok(aUser({ emailVerified: true })));
    expect(calls).toEqual([{ kind: 'applyActionCode', code: 'CODE' }, { kind: 'reloadUser' }]);
  });

  it('renvoie null quand personne n’est connecté dans ce navigateur', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: ok(null) });
    expect(await authUseCases(gateway).confirmEmail('CODE')).toEqual(ok(null));
  });

  it('reste réussie si la relecture échoue : l’adresse est confirmée', async () => {
    const { gateway } = fakeAuthGateway({ reloadUser: fail('auth-network') });
    expect(await authUseCases(gateway).confirmEmail('CODE')).toEqual(ok(null));
  });

  it('fait remonter un lien expiré sans relire l’utilisateur', async () => {
    const { gateway, calls } = fakeAuthGateway({ applyActionCode: fail('auth-action-expired') });
    expect(await authUseCases(gateway).confirmEmail('CODE')).toEqual(fail('auth-action-expired'));
    expect(calls.map((call) => call.kind)).toEqual(['applyActionCode']);
  });
});

describe('lien d’annulation d’un changement d’adresse', () => {
  it('applique le code puis relit l’utilisateur', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(await authUseCases(gateway).recoverEmail('CODE')).toEqual(ok(undefined));
    expect(calls).toEqual([{ kind: 'applyActionCode', code: 'CODE' }, { kind: 'reloadUser' }]);
  });

  it('fait remonter un lien invalide', async () => {
    const { gateway } = fakeAuthGateway({ applyActionCode: fail('auth-action-invalid') });
    expect(await authUseCases(gateway).recoverEmail('CODE')).toEqual(fail('auth-action-invalid'));
  });
});

describe('lien de réinitialisation du mot de passe', () => {
  it('vérifie le code et renvoie l’adresse du compte', async () => {
    const { gateway, calls } = fakeAuthGateway({ verifyPasswordResetCode: ok('camille@example.com') });
    expect(await authUseCases(gateway).verifyPasswordReset('CODE')).toEqual(ok('camille@example.com'));
    expect(calls).toEqual([{ kind: 'verifyPasswordResetCode', code: 'CODE' }]);
  });

  it('fait remonter un lien expiré', async () => {
    const { gateway } = fakeAuthGateway({ verifyPasswordResetCode: fail('auth-action-expired') });
    expect(await authUseCases(gateway).verifyPasswordReset('CODE')).toEqual(fail('auth-action-expired'));
  });

  it('enregistre le nouveau mot de passe', async () => {
    const { gateway, calls } = fakeAuthGateway();
    expect(await authUseCases(gateway).resetPassword('CODE', 'nouveaumdp', 'nouveaumdp')).toEqual(
      ok(undefined),
    );
    expect(calls).toEqual([{ kind: 'confirmPasswordReset', code: 'CODE', password: 'nouveaumdp' }]);
  });

  it.each([
    ['trop court', 'court', 'court', 'auth-password-too-short'],
    ['mal confirmé', 'nouveaumdp', 'nouveaumdq', 'auth-password-mismatch'],
  ] as const)(
    'refuse un mot de passe %s sans appeler le fournisseur',
    async (_, password, confirmation, code) => {
      const { gateway, calls } = fakeAuthGateway();
      expect(await authUseCases(gateway).resetPassword('CODE', password, confirmation)).toEqual(fail(code));
      expect(calls).toEqual([]);
    },
  );

  it('fait remonter un lien devenu invalide entre-temps', async () => {
    const { gateway } = fakeAuthGateway({ confirmPasswordReset: fail('auth-action-invalid') });
    expect(await authUseCases(gateway).resetPassword('CODE', 'nouveaumdp', 'nouveaumdp')).toEqual(
      fail('auth-action-invalid'),
    );
  });
});
