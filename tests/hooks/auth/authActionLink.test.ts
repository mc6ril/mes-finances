import { fail } from '@/core/shared/errors';
import {
  afterAuthAction,
  isLinkFailure,
  linkRecovery,
  statusAfterConfirmation,
} from '@/hooks/auth/authActionLink';
import { AUTH_PATHS } from '@/ui/routing/authPaths';
import { aUser } from '../../core/usecases/fakeAuthGateway';

describe('lien inutilisable', () => {
  it.each(['auth-action-expired', 'auth-action-invalid', 'auth-user-disabled'] as const)(
    '%s rend le lien inutilisable',
    (code) => {
      expect(isLinkFailure(fail(code).error)).toBe(true);
    },
  );

  it.each(['auth-network', 'auth-password-too-short', 'auth-too-many-requests'] as const)(
    '%s laisse une nouvelle tentative possible',
    (code) => {
      expect(isLinkFailure(fail(code).error)).toBe(false);
    },
  );
});

describe('solution proposée quand le lien ne fonctionne pas', () => {
  it('renvoie l’e-mail de confirmation à la personne connectée qui attend la confirmation', () => {
    expect(linkRecovery('verifyEmail', 'unverified', fail('auth-action-expired').error)).toBe(
      'resend-verification',
    );
  });

  it('propose de se connecter pour recevoir un nouveau lien de confirmation', () => {
    expect(linkRecovery('verifyEmail', 'signed-out', fail('auth-action-expired').error)).toBe('continue');
  });

  it('propose de redemander un lien de réinitialisation, sans être connecté', () => {
    expect(linkRecovery('resetPassword', 'signed-out', fail('auth-action-invalid').error)).toBe(
      'request-password-reset',
    );
    expect(linkRecovery('resetPassword', 'signed-in', fail('auth-action-invalid').error)).toBe('continue');
  });

  it('ne propose rien de plus pour un compte désactivé', () => {
    expect(linkRecovery('verifyEmail', 'unverified', fail('auth-user-disabled').error)).toBe('continue');
    expect(linkRecovery('resetPassword', 'signed-out', fail('auth-user-disabled').error)).toBe('continue');
  });

  it('se contente de continuer pour une annulation de changement d’adresse', () => {
    expect(linkRecovery('recoverEmail', 'signed-out', fail('auth-action-invalid').error)).toBe('continue');
  });
});

describe('état de la session après confirmation de l’adresse', () => {
  it('déconnecté si personne n’est connecté dans ce navigateur', () => {
    expect(statusAfterConfirmation(null)).toBe('signed-out');
  });

  it('connecté si le compte ouvert est confirmé', () => {
    expect(statusAfterConfirmation(aUser({ emailVerified: true }))).toBe('signed-in');
  });

  it('toujours en attente si le compte ouvert est un autre compte non confirmé', () => {
    expect(statusAfterConfirmation(aUser({ emailVerified: false }))).toBe('unverified');
  });
});

describe('destination après un lien traité', () => {
  it('ouvre le tableau de bord de la personne connectée, avec un message', () => {
    expect(afterAuthAction('verifyEmail', 'signed-in')).toEqual({ path: '/', notice: 'email-verified' });
  });

  it('envoie sur la connexion, avec un message, sans session dans ce navigateur', () => {
    expect(afterAuthAction('verifyEmail', 'signed-out')).toEqual({
      path: AUTH_PATHS.signIn,
      notice: 'email-verified',
    });
  });

  it('préremplit l’adresse à la connexion après un nouveau mot de passe', () => {
    expect(afterAuthAction('resetPassword', 'signed-out', 'camille@example.com')).toEqual({
      path: AUTH_PATHS.signIn,
      notice: 'password-reset',
      email: 'camille@example.com',
    });
  });

  it('annonce l’adresse rétablie', () => {
    expect(afterAuthAction('recoverEmail', 'unverified')).toEqual({ path: '/', notice: 'email-recovered' });
  });

  it('revient simplement à l’application quand on abandonne', () => {
    expect(afterAuthAction(null, 'signed-out')).toEqual({ path: AUTH_PATHS.signIn, notice: null });
    expect(afterAuthAction(null, 'signed-in')).toEqual({ path: '/', notice: null });
  });
});
