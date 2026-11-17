export const AUTH_PATHS = {
  signIn: '/connexion',
  signUp: '/inscription',
  forgotPassword: '/mot-de-passe-oublie',
} as const;

/** Message affiché à l'arrivée sur la connexion après un lien reçu par e-mail. */
export const AUTH_NOTICES = ['email-verified', 'password-reset', 'email-recovered'] as const;

export type AuthNotice = (typeof AUTH_NOTICES)[number];

/** E-mail saisi transmis d'un écran à l'autre (connexion → mot de passe oublié…), et message éventuel. */
export type AuthLocationState = { email?: string; notice?: AuthNotice } | null;

export const emailFrom = (state: unknown): string =>
  typeof state === 'object' && state !== null && 'email' in state && typeof state.email === 'string'
    ? state.email
    : '';

export const noticeFrom = (state: unknown): AuthNotice | null =>
  typeof state === 'object' && state !== null && 'notice' in state
    ? (AUTH_NOTICES.find((notice) => notice === state.notice) ?? null)
    : null;
