import { takeAuthActionLink } from '@/adapters/browser/authActionUrl';

const browser = (search: string, hash = '') => {
  const replaceState = vi.fn();
  return {
    location: { pathname: '/', search, hash },
    history: { state: { idx: 0 }, replaceState },
    replaceState,
  };
};

describe('lien d’e-mail lu au démarrage', () => {
  it('renvoie le lien et le retire de l’adresse, sans toucher au reste', () => {
    const { location, history, replaceState } = browser(
      '?mode=verifyEmail&oobCode=CODE&apiKey=cle&lang=fr&utm_source=mail',
      '#/budget',
    );
    expect(takeAuthActionLink(location, history)).toEqual({ mode: 'verifyEmail', code: 'CODE' });
    expect(replaceState).toHaveBeenCalledWith({ idx: 0 }, '', '/?utm_source=mail#/budget');
  });

  it('ne modifie pas l’adresse sans lien à traiter', () => {
    const { location, history, replaceState } = browser('', '#/connexion');
    expect(takeAuthActionLink(location, history)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
