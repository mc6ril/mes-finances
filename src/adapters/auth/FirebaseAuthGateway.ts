import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import type { AuthProviderId, AuthUser, SignUpCredentials } from '@/core/auth/model';
import { fail, ok, type AppErrorCode, type Result } from '@/core/shared/errors';
import type { AuthGatewayInterface, AuthListener } from '@/core/auth/interface';

const ERROR_CODES: Record<string, AppErrorCode> = {
  'auth/invalid-credential': 'auth-invalid-credentials',
  'auth/invalid-login-credentials': 'auth-invalid-credentials',
  'auth/wrong-password': 'auth-invalid-credentials',
  'auth/user-not-found': 'auth-invalid-credentials',
  'auth/email-already-in-use': 'auth-email-taken',
  'auth/weak-password': 'auth-password-too-short',
  'auth/invalid-email': 'auth-email-invalid',
  'auth/missing-email': 'auth-email-invalid',
  'auth/missing-password': 'auth-password-empty',
  'auth/too-many-requests': 'auth-too-many-requests',
  'auth/network-request-failed': 'auth-network',
  'auth/popup-closed-by-user': 'auth-cancelled',
  'auth/cancelled-popup-request': 'auth-cancelled',
  'auth/user-cancelled': 'auth-cancelled',
  'auth/popup-blocked': 'auth-popup-blocked',
  'auth/account-exists-with-different-credential': 'auth-other-provider',
  'auth/user-disabled': 'auth-user-disabled',
  'auth/operation-not-allowed': 'auth-provider-disabled',
  'auth/unauthorized-domain': 'auth-unauthorized-domain',
};

const PROVIDERS: Record<string, AuthProviderId> = { password: 'password', 'google.com': 'google' };

export const authErrorCode = (error: unknown): AppErrorCode => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  return (typeof code === 'string' && ERROR_CODES[code]) || 'auth-failed';
};

const toAuthUser = (user: User): AuthUser => ({
  id: user.uid,
  email: user.email,
  displayName: user.displayName,
  emailVerified: user.emailVerified,
  providers: user.providerData.flatMap(({ providerId }) => PROVIDERS[providerId] ?? []),
});

const attempt = async <T>(operation: () => Promise<T>): Promise<Result<T>> => {
  try {
    return ok(await operation());
  } catch (error) {
    return fail(authErrorCode(error));
  }
};

export class FirebaseAuthGateway implements AuthGatewayInterface {
  #auth: Auth;

  constructor(auth: Auth) {
    this.#auth = auth;
  }

  onChange(listener: AuthListener): () => void {
    return onAuthStateChanged(this.#auth, (user) => listener(user ? toAuthUser(user) : null));
  }

  async signUp({ displayName, email, password }: SignUpCredentials): Promise<Result<AuthUser>> {
    const created = await attempt(() => createUserWithEmailAndPassword(this.#auth, email, password));
    if (!created.ok) {
      return created;
    }
    const { user } = created.value;
    // Le compte est créé : un prénom non enregistré ne doit pas faire échouer l'inscription.
    const named = await attempt(() => updateProfile(user, { displayName }));
    return ok({ ...toAuthUser(user), displayName: named.ok ? displayName : user.displayName });
  }

  async signIn(email: string, password: string): Promise<Result<AuthUser>> {
    const signedIn = await attempt(() => signInWithEmailAndPassword(this.#auth, email, password));
    return signedIn.ok ? ok(toAuthUser(signedIn.value.user)) : signedIn;
  }

  async signInWithGoogle(): Promise<Result<AuthUser>> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const signedIn = await attempt(() => signInWithPopup(this.#auth, provider));
    return signedIn.ok ? ok(toAuthUser(signedIn.value.user)) : signedIn;
  }

  signOut(): Promise<Result<void>> {
    return attempt(() => signOut(this.#auth));
  }

  async sendPasswordReset(email: string): Promise<Result<void>> {
    const sent = await attempt(() => sendPasswordResetEmail(this.#auth, email));
    // Ne pas révéler si un compte existe pour cette adresse.
    if (!sent.ok && sent.error.code === 'auth-invalid-credentials') {
      return ok(undefined);
    }
    return sent;
  }

  async sendEmailVerification(): Promise<Result<void>> {
    const user = this.#auth.currentUser;
    if (!user) {
      return fail('auth-failed');
    }
    return attempt(() => sendEmailVerification(user));
  }
}
