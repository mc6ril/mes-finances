import { needsEmailVerification, reauthenticationMethod, userLabel } from '@/core/auth/model';
import { aUser } from '../usecases/fakeAuthGateway';

describe('vérification de l’adresse e-mail', () => {
  it('bloque un compte dont l’adresse n’est pas confirmée', () => {
    expect(needsEmailVerification(aUser({ emailVerified: false }))).toBe(true);
  });

  it('laisse passer un compte confirmé (Google l’est d’office)', () => {
    expect(needsEmailVerification(aUser({ emailVerified: true, providers: ['google'] }))).toBe(false);
  });
});

describe('méthode de ré-authentification', () => {
  it('passe par Google si le compte y est lié', () => {
    expect(reauthenticationMethod(aUser({ providers: ['password', 'google'] }))).toBe('google');
  });

  it('demande le mot de passe sinon', () => {
    expect(reauthenticationMethod(aUser({ providers: ['password'] }))).toBe('password');
  });
});

describe('nom affiché', () => {
  it('reprend le prénom, sinon le début de l’e-mail', () => {
    expect(userLabel(aUser({ displayName: ' Camille ' }))).toBe('Camille');
    expect(userLabel(aUser({ displayName: null, email: 'jean.d@example.com' }))).toBe('jean.d');
    expect(userLabel(aUser({ displayName: null, email: null }))).toBe('Mon compte');
  });
});
