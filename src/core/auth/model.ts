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

/** Prénom affiché : nom du profil, sinon partie locale de l'e-mail. */
export const userLabel = (user: AuthUser): string =>
  user.displayName?.trim() || user.email?.split('@')[0] || 'Mon compte';
