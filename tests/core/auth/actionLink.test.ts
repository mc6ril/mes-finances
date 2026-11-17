import { parseAuthAction, withoutAuthAction } from '@/core/auth/actionLink';

const firebaseLink = (mode: string, extra = '') =>
  `?mode=${mode}&oobCode=CODE-123&apiKey=cle-publique&continueUrl=https%3A%2F%2Fexemple.fr&lang=fr${extra}`;

describe('lecture d’un lien d’e-mail d’authentification', () => {
  it.each(['verifyEmail', 'resetPassword', 'recoverEmail'] as const)('reconnaît le mode %s', (mode) => {
    expect(parseAuthAction(firebaseLink(mode))).toEqual({ mode, code: 'CODE-123' });
  });

  it('accepte une chaîne sans « ? » initial et décode le code', () => {
    expect(parseAuthAction('mode=verifyEmail&oobCode=a%2Bb%3D')).toEqual({
      mode: 'verifyEmail',
      code: 'a+b=',
    });
  });

  it.each([
    ['une adresse sans paramètres', ''],
    ['un lien sans code', '?mode=verifyEmail&apiKey=cle'],
    ['un code vide', '?mode=resetPassword&oobCode='],
    ['un lien sans mode', '?oobCode=CODE-123'],
    ['un mode non pris en charge', '?mode=signIn&oobCode=CODE-123'],
    ['des paramètres sans rapport', '?utm_source=mail'],
  ])('ignore %s', (_, search) => {
    expect(parseAuthAction(search)).toBeNull();
  });
});

describe('nettoyage de l’adresse après lecture du lien', () => {
  it('retire tous les paramètres ajoutés par Firebase', () => {
    expect(withoutAuthAction(firebaseLink('verifyEmail'))).toBe('');
  });

  it('garde les autres paramètres', () => {
    expect(withoutAuthAction(firebaseLink('resetPassword', '&utm_source=mail&tenantId=t1'))).toBe(
      '?utm_source=mail',
    );
  });

  it('laisse une adresse sans paramètres intacte', () => {
    expect(withoutAuthAction('')).toBe('');
  });
});
