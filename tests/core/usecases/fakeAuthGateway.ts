import type { AuthUser, Reauthentication, SignUpCredentials } from '@/core/auth/model';
import { ok, type Result } from '@/core/shared/errors';
import type { AuthGatewayInterface, AuthListener } from '@/core/auth/interface';

export type AuthCall =
  | { kind: 'signUp'; credentials: SignUpCredentials }
  | { kind: 'signIn'; email: string; password: string }
  | { kind: 'signInWithGoogle' }
  | { kind: 'signOut' }
  | { kind: 'sendPasswordReset'; email: string }
  | { kind: 'sendEmailVerification' }
  | { kind: 'reloadUser' }
  | { kind: 'deleteAccount'; reauthentication: Reauthentication };

export const aUser = (patch: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  email: 'jean.d@example.com',
  displayName: 'Jean D.',
  emailVerified: true,
  providers: ['password'],
  ...patch,
});

type Answers = Partial<{
  signUp: Result<AuthUser>;
  signIn: Result<AuthUser>;
  signInWithGoogle: Result<AuthUser>;
  signOut: Result<void>;
  sendPasswordReset: Result<void>;
  sendEmailVerification: Result<void>;
  reloadUser: Result<AuthUser | null>;
  deleteAccount: Result<void>;
}>;

/** Faux fournisseur d'identité : enregistre les appels et permet d'émettre des changements de session. */
export const fakeAuthGateway = (answers: Answers = {}) => {
  const calls: AuthCall[] = [];
  const listeners = new Set<AuthListener>();
  const gateway: AuthGatewayInterface = {
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signUp: async (credentials) => {
      calls.push({ kind: 'signUp', credentials });
      return answers.signUp ?? ok(aUser({ email: credentials.email, displayName: credentials.displayName }));
    },
    signIn: async (email, password) => {
      calls.push({ kind: 'signIn', email, password });
      return answers.signIn ?? ok(aUser({ email }));
    },
    signInWithGoogle: async () => {
      calls.push({ kind: 'signInWithGoogle' });
      return answers.signInWithGoogle ?? ok(aUser({ providers: ['google'], emailVerified: true }));
    },
    signOut: async () => {
      calls.push({ kind: 'signOut' });
      return answers.signOut ?? ok(undefined);
    },
    sendPasswordReset: async (email) => {
      calls.push({ kind: 'sendPasswordReset', email });
      return answers.sendPasswordReset ?? ok(undefined);
    },
    sendEmailVerification: async () => {
      calls.push({ kind: 'sendEmailVerification' });
      return answers.sendEmailVerification ?? ok(undefined);
    },
    reloadUser: async () => {
      calls.push({ kind: 'reloadUser' });
      return answers.reloadUser ?? ok(aUser());
    },
    deleteAccount: async (reauthentication) => {
      calls.push({ kind: 'deleteAccount', reauthentication });
      return answers.deleteAccount ?? ok(undefined);
    },
  };
  const emit = (user: AuthUser | null) => listeners.forEach((listener) => listener(user));
  return { gateway, calls, emit, listenerCount: () => listeners.size };
};
