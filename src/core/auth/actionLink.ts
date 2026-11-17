/** Liens des e-mails d'authentification traités par l'application (URL d'action personnalisée). */
export const AUTH_ACTION_MODES = ['verifyEmail', 'resetPassword', 'recoverEmail'] as const;

export type AuthActionMode = (typeof AUTH_ACTION_MODES)[number];

export type AuthActionLink = { mode: AuthActionMode; code: string };

/** Paramètres ajoutés par Firebase à l'URL d'action, avant le « # » du routage. */
const FIREBASE_PARAMS = ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang', 'tenantId'];

const isMode = (mode: string | null): mode is AuthActionMode =>
  AUTH_ACTION_MODES.some((known) => known === mode);

/** Lit `window.location.search` : null si ce n'est pas un lien d'e-mail pris en charge. */
export const parseAuthAction = (search: string): AuthActionLink | null => {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const code = params.get('oobCode');
  return isMode(mode) && code ? { mode, code } : null;
};

/** Partie « ? » de l'adresse sans les paramètres Firebase, pour ne pas retraiter le lien au rechargement. */
export const withoutAuthAction = (search: string): string => {
  const params = new URLSearchParams(search);
  FIREBASE_PARAMS.forEach((name) => params.delete(name));
  const rest = params.toString();
  return rest ? `?${rest}` : '';
};
