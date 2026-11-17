import type { AuthActionMode } from '@/core/auth/actionLink';
import { type AuthUser, needsEmailVerification } from '@/core/auth/model';
import type { AppError, AppErrorCode } from '@/core/shared/errors';
import type { AuthStatus } from '@/core/store/AuthSession';
import { AUTH_PATHS, type AuthNotice } from '@/ui/routing/authPaths';

export const AUTH_NOTICE_MESSAGES: Record<AuthNotice, { signedOut: string; signedIn: string }> = {
  'email-verified': { signedOut: 'Adresse confirmée, connecte-toi.', signedIn: 'Adresse confirmée.' },
  'password-reset': {
    signedOut: 'Mot de passe modifié, connecte-toi avec le nouveau.',
    signedIn: 'Mot de passe modifié.',
  },
  'email-recovered': {
    signedOut: 'Ton adresse de connexion a été rétablie, connecte-toi.',
    signedIn: 'Ton adresse de connexion a été rétablie.',
  },
};

const NOTICES: Record<AuthActionMode, AuthNotice> = {
  verifyEmail: 'email-verified',
  resetPassword: 'password-reset',
  recoverEmail: 'email-recovered',
};

const LINK_FAILURES: AppErrorCode[] = ['auth-action-expired', 'auth-action-invalid', 'auth-user-disabled'];

/** Lien expiré, déjà utilisé, invalide ou compte désactivé : réessayer avec ce lien ne sert à rien. */
export const isLinkFailure = (error: AppError): boolean => LINK_FAILURES.includes(error.code);

export type LinkRecovery = 'resend-verification' | 'request-password-reset' | 'continue';

/**
 * Solution proposée sous l'erreur. Sans session, un nouvel e-mail de confirmation s'obtient en se
 * connectant (l'écran « Confirme ton adresse » permet le renvoi).
 */
export const linkRecovery = (mode: AuthActionMode, status: AuthStatus, error: AppError): LinkRecovery => {
  if (error.code === 'auth-user-disabled') {
    return 'continue';
  }
  if (mode === 'verifyEmail' && status === 'unverified') {
    return 'resend-verification';
  }
  if (mode === 'resetPassword' && status !== 'signed-in' && status !== 'unverified') {
    return 'request-password-reset';
  }
  return 'continue';
};

/** État de la session une fois le lien de confirmation appliqué (l'utilisateur relu, s'il y en a un). */
export const statusAfterConfirmation = (user: AuthUser | null): AuthStatus => {
  if (!user) {
    return 'signed-out';
  }
  return needsEmailVerification(user) ? 'unverified' : 'signed-in';
};

export type AuthActionDestination = { path: string; notice: AuthNotice | null; email?: string };

/** Où aller une fois le lien traité (ou abandonné, `mode` null). */
export const afterAuthAction = (
  mode: AuthActionMode | null,
  status: AuthStatus,
  email?: string,
): AuthActionDestination => {
  const notice = mode ? NOTICES[mode] : null;
  if (status === 'signed-in' || status === 'unverified') {
    return { path: '/', notice };
  }
  return email ? { path: AUTH_PATHS.signIn, notice, email } : { path: AUTH_PATHS.signIn, notice };
};
