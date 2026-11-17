export const AUTH_PATHS = {
  signIn: '/connexion',
  signUp: '/inscription',
  forgotPassword: '/mot-de-passe-oublie',
} as const;

/** E-mail saisi transmis d'un écran à l'autre (connexion → mot de passe oublié…). */
export type AuthLocationState = { email?: string } | null;

export const emailFrom = (state: unknown): string =>
  typeof state === 'object' && state !== null && 'email' in state && typeof state.email === 'string'
    ? state.email
    : '';
