import type { Auth, User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { authErrorCode, FirebaseAuthGateway } from '@/adapters/auth/FirebaseAuthGateway';
import { readFirebaseConfig } from '@/adapters/firebase/firebaseConfig';

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn((email: string, password: string) => ({ email, password })) },
  deleteUser: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  reload: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider(this: { setCustomParameters: () => void }) {
    this.setCustomParameters = vi.fn();
  }),
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

const firebaseError = (code: string) => Object.assign(new Error(code), { code });

const firebaseUser = (patch: Partial<User> = {}): User =>
  ({
    uid: 'uid-1',
    email: 'jean.d@example.com',
    displayName: 'Jean D.',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }, { providerId: 'phone' }],
    ...patch,
  }) as User;

const expectedUser = {
  id: 'uid-1',
  email: 'jean.d@example.com',
  displayName: 'Jean D.',
  emailVerified: true,
  providers: ['google', 'password'],
};

const setup = (currentUser: User | null = null) => {
  const auth = { currentUser } as Auth;
  return { auth, gateway: new FirebaseAuthGateway(auth) };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('traduction des erreurs Firebase', () => {
  it.each([
    ['auth/invalid-credential', 'auth-invalid-credentials'],
    ['auth/wrong-password', 'auth-invalid-credentials'],
    ['auth/user-not-found', 'auth-invalid-credentials'],
    ['auth/email-already-in-use', 'auth-email-taken'],
    ['auth/weak-password', 'auth-password-too-short'],
    ['auth/invalid-email', 'auth-email-invalid'],
    ['auth/too-many-requests', 'auth-too-many-requests'],
    ['auth/network-request-failed', 'auth-network'],
    ['auth/popup-closed-by-user', 'auth-cancelled'],
    ['auth/cancelled-popup-request', 'auth-cancelled'],
    ['auth/popup-blocked', 'auth-popup-blocked'],
    ['auth/account-exists-with-different-credential', 'auth-other-provider'],
    ['auth/user-disabled', 'auth-user-disabled'],
    ['auth/operation-not-allowed', 'auth-provider-disabled'],
    ['auth/unauthorized-domain', 'auth-unauthorized-domain'],
    ['auth/requires-recent-login', 'auth-requires-recent-login'],
    ['auth/user-mismatch', 'auth-user-mismatch'],
    ['auth/inconnu', 'auth-failed'],
  ])('%s → %s', (code, expected) => {
    expect(authErrorCode(firebaseError(code))).toBe(expected);
  });

  it('traite une erreur sans code comme un échec générique', () => {
    expect(authErrorCode(new Error('boom'))).toBe('auth-failed');
    expect(authErrorCode('boom')).toBe('auth-failed');
  });
});

describe('suivi de la session', () => {
  it('traduit l’utilisateur Firebase et se désabonne', () => {
    const unsubscribe = vi.fn();
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, next) => {
      (next as (user: User | null) => void)(firebaseUser());
      (next as (user: User | null) => void)(null);
      return unsubscribe;
    });
    const listener = vi.fn();
    const stop = setup().gateway.onChange(listener);
    expect(listener.mock.calls).toEqual([[expectedUser], [null]]);
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('inscription', () => {
  it('crée le compte et enregistre le prénom', async () => {
    const user = firebaseUser({ displayName: null, emailVerified: false, providerData: [] });
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user } as never);
    vi.mocked(updateProfile).mockResolvedValue();
    const { auth, gateway } = setup();
    const result = await gateway.signUp({
      displayName: 'Camille',
      email: 'camille@example.com',
      password: 'motdepasse',
    });
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'camille@example.com', 'motdepasse');
    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Camille' });
    expect(result).toEqual({
      ok: true,
      value: { ...expectedUser, displayName: 'Camille', emailVerified: false, providers: [] },
    });
  });

  it('traduit un e-mail déjà utilisé', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValue(firebaseError('auth/email-already-in-use'));
    const result = await setup().gateway.signUp({ displayName: 'C', email: 'c@example.com', password: 'x' });
    expect(result).toEqual({ ok: false, error: { code: 'auth-email-taken' } });
  });

  it('reste réussie si le prénom n’a pas pu être enregistré', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user: firebaseUser() } as never);
    vi.mocked(updateProfile).mockRejectedValue(firebaseError('auth/network-request-failed'));
    const result = await setup().gateway.signUp({ displayName: 'C', email: 'c@example.com', password: 'x' });
    expect(result.ok).toBe(true);
  });
});

describe('connexion', () => {
  it('connecte avec e-mail et mot de passe', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({ user: firebaseUser() } as never);
    const { auth, gateway } = setup();
    expect(await gateway.signIn('jean.d@example.com', 'secret')).toEqual({ ok: true, value: expectedUser });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'jean.d@example.com', 'secret');
  });

  it('traduit des identifiants incorrects', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(firebaseError('auth/invalid-credential'));
    expect(await setup().gateway.signIn('jean@example.com', 'faux')).toEqual({
      ok: false,
      error: { code: 'auth-invalid-credentials' },
    });
  });

  it('connecte avec Google via une fenêtre', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({ user: firebaseUser() } as never);
    const { auth, gateway } = setup();
    expect(await gateway.signInWithGoogle()).toEqual({ ok: true, value: expectedUser });
    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.anything());
  });

  it('traduit la fermeture de la fenêtre Google', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue(firebaseError('auth/popup-closed-by-user'));
    expect(await setup().gateway.signInWithGoogle()).toEqual({
      ok: false,
      error: { code: 'auth-cancelled' },
    });
  });
});

describe('déconnexion', () => {
  it('déconnecte', async () => {
    vi.mocked(signOut).mockResolvedValue();
    expect(await setup().gateway.signOut()).toEqual({ ok: true, value: undefined });
  });

  it('traduit une erreur réseau', async () => {
    vi.mocked(signOut).mockRejectedValue(firebaseError('auth/network-request-failed'));
    expect(await setup().gateway.signOut()).toEqual({ ok: false, error: { code: 'auth-network' } });
  });
});

describe('mot de passe oublié', () => {
  it('envoie le lien de réinitialisation', async () => {
    vi.mocked(sendPasswordResetEmail).mockResolvedValue();
    const { auth, gateway } = setup();
    expect(await gateway.sendPasswordReset('jean@example.com')).toEqual({ ok: true, value: undefined });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'jean@example.com');
  });

  it('ne révèle pas qu’une adresse n’a pas de compte', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(firebaseError('auth/user-not-found'));
    expect(await setup().gateway.sendPasswordReset('inconnu@example.com')).toEqual({
      ok: true,
      value: undefined,
    });
  });
});

describe('vérification de l’adresse', () => {
  it('envoie l’e-mail à l’utilisateur connecté', async () => {
    vi.mocked(sendEmailVerification).mockResolvedValue();
    const user = firebaseUser();
    expect(await setup(user).gateway.sendEmailVerification()).toEqual({ ok: true, value: undefined });
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('échoue sans utilisateur connecté', async () => {
    expect(await setup(null).gateway.sendEmailVerification()).toEqual({
      ok: false,
      error: { code: 'auth-failed' },
    });
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });
});

describe('rechargement de l’utilisateur', () => {
  it('recharge le profil et force un nouveau jeton pour refléter la confirmation', async () => {
    const getIdToken = vi.fn().mockResolvedValue('jeton');
    const user = firebaseUser({ emailVerified: false, getIdToken } as Partial<User>);
    vi.mocked(reload).mockImplementation(async () => {
      Object.assign(user, { emailVerified: true });
    });
    expect(await setup(user).gateway.reloadUser()).toEqual({ ok: true, value: expectedUser });
    expect(reload).toHaveBeenCalledWith(user);
    expect(getIdToken).toHaveBeenCalledWith(true);
  });

  it('renvoie null sans utilisateur connecté', async () => {
    expect(await setup(null).gateway.reloadUser()).toEqual({ ok: true, value: null });
    expect(reload).not.toHaveBeenCalled();
  });

  it('traduit une erreur réseau', async () => {
    vi.mocked(reload).mockRejectedValue(firebaseError('auth/network-request-failed'));
    expect(await setup(firebaseUser()).gateway.reloadUser()).toEqual({
      ok: false,
      error: { code: 'auth-network' },
    });
  });
});

describe('suppression du compte', () => {
  it('ré-authentifie avec le mot de passe puis supprime', async () => {
    vi.mocked(reauthenticateWithCredential).mockResolvedValue({} as never);
    vi.mocked(deleteUser).mockResolvedValue();
    const user = firebaseUser();
    expect(await setup(user).gateway.deleteAccount({ method: 'password', password: 'secret' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(EmailAuthProvider.credential).toHaveBeenCalledWith('jean.d@example.com', 'secret');
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(user, {
      email: 'jean.d@example.com',
      password: 'secret',
    });
    expect(deleteUser).toHaveBeenCalledWith(user);
  });

  it('ré-authentifie avec Google puis supprime', async () => {
    vi.mocked(reauthenticateWithPopup).mockResolvedValue({} as never);
    vi.mocked(deleteUser).mockResolvedValue();
    const user = firebaseUser();
    expect(await setup(user).gateway.deleteAccount({ method: 'google' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(reauthenticateWithPopup).toHaveBeenCalledWith(user, expect.anything());
    expect(deleteUser).toHaveBeenCalledWith(user);
  });

  it('ne supprime pas si le mot de passe est incorrect', async () => {
    vi.mocked(reauthenticateWithCredential).mockRejectedValue(firebaseError('auth/invalid-credential'));
    expect(
      await setup(firebaseUser()).gateway.deleteAccount({ method: 'password', password: 'faux' }),
    ).toEqual({ ok: false, error: { code: 'auth-invalid-credentials' } });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('refuse un autre compte Google que celui connecté', async () => {
    vi.mocked(reauthenticateWithPopup).mockRejectedValue(firebaseError('auth/user-mismatch'));
    expect(await setup(firebaseUser()).gateway.deleteAccount({ method: 'google' })).toEqual({
      ok: false,
      error: { code: 'auth-user-mismatch' },
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('échoue sans utilisateur connecté', async () => {
    expect(await setup(null).gateway.deleteAccount({ method: 'google' })).toEqual({
      ok: false,
      error: { code: 'auth-failed' },
    });
  });

  it('échoue par mot de passe pour un compte sans e-mail', async () => {
    expect(
      await setup(firebaseUser({ email: null })).gateway.deleteAccount({ method: 'password', password: 'x' }),
    ).toEqual({ ok: false, error: { code: 'auth-failed' } });
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });
});

describe('configuration Firebase', () => {
  const env = {
    VITE_FIREBASE_API_KEY: 'cle-factice',
    VITE_FIREBASE_AUTH_DOMAIN: 'projet.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'projet',
    VITE_FIREBASE_APP_ID: '1:000:web:000',
  };

  it('lit la configuration depuis les variables d’environnement', () => {
    expect(readFirebaseConfig(env)).toEqual({
      apiKey: 'cle-factice',
      authDomain: 'projet.firebaseapp.com',
      projectId: 'projet',
      appId: '1:000:web:000',
    });
  });

  it.each(Object.keys(env))('est absente si %s manque', (key) => {
    expect(readFirebaseConfig({ ...env, [key]: '' })).toBeNull();
  });
});
