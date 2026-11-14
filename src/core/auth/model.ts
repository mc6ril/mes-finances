export type AuthProviderId = 'password' | 'google';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providers: AuthProviderId[];
};

export type SignInForm = { email: string; password: string };

export type SignUpForm = { displayName: string; email: string; password: string; confirmation: string };

export type SignUpCredentials = { displayName: string; email: string; password: string };

/** Preuve d'identité redemandée avant une action sensible (suppression du compte). */
export type Reauthentication = { method: 'password'; password: string } | { method: 'google' };

export type ReauthenticationMethod = Reauthentication['method'];

/** Un compte par e-mail n'accède à l'application qu'une fois son adresse confirmée. */
export const needsEmailVerification = (user: AuthUser): boolean => !user.emailVerified;

/** Google si le compte y est lié (pas de saisie), sinon le mot de passe. */
export const reauthenticationMethod = (user: AuthUser): ReauthenticationMethod =>
  user.providers.includes('google') ? 'google' : 'password';

/** Prénom affiché : nom du profil, sinon partie locale de l'e-mail. */
export const userLabel = (user: AuthUser): string =>
  user.displayName?.trim() || user.email?.split('@')[0] || 'Mon compte';
