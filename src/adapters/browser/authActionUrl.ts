import { type AuthActionLink, parseAuthAction, withoutAuthAction } from '@/core/auth/actionLink';

type BrowserLocation = Pick<Location, 'pathname' | 'search' | 'hash'>;
type BrowserHistory = Pick<History, 'state' | 'replaceState'>;

/**
 * Lien d'un e-mail d'authentification : Firebase place ses paramètres avant le « # » du routage.
 * Lu une seule fois au démarrage, puis retiré de l'adresse pour qu'un rechargement ne le retraite pas.
 */
export const takeAuthActionLink = (
  location: BrowserLocation,
  history: BrowserHistory,
): AuthActionLink | null => {
  const link = parseAuthAction(location.search);
  if (link) {
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${withoutAuthAction(location.search)}${location.hash}`,
    );
  }
  return link;
};
