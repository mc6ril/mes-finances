import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AuthActionLink, AuthActionMode } from '@/core/auth/actionLink';
import type { AppError } from '@/core/shared/errors';
import type { AuthStatus } from '@/core/store/AuthSession';
import { errorMessage } from '@/ui/errorMessages';
import { AUTH_PATHS, type AuthLocationState } from '@/ui/routing/authPaths';
import { useAuthAction, useAuthState, useAuthUseCases } from '../useAuth';
import { useToast } from '../useToast';
import {
  afterAuthAction,
  AUTH_NOTICE_MESSAGES,
  isLinkFailure,
  linkRecovery,
  statusAfterConfirmation,
  type LinkRecovery,
} from './authActionLink';

export type AuthActionPhase =
  | { step: 'checking' }
  | { step: 'password'; email: string }
  | { step: 'recovered' }
  | { step: 'failed'; error: AppError; recovery: LinkRecovery };

/**
 * Traite le lien d'un e-mail d'authentification, une fois la session connue (le résultat dépend de
 * la personne connectée dans ce navigateur), puis rend la main à l'application via `onDone`.
 */
export const useAuthActionLink = (link: AuthActionLink, onDone: () => void) => {
  const auth = useAuthUseCases();
  const { status } = useAuthState();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [phase, setPhase] = useState<AuthActionPhase>({ step: 'checking' });
  // Un code ne sert qu'une fois : il ne doit pas partir deux fois (double effet du mode strict).
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const resend = useAuthAction();
  const [resent, setResent] = useState(false);

  const leave = useCallback(
    (mode: AuthActionMode | null, sessionStatus: AuthStatus, email?: string) => {
      const destination = afterAuthAction(mode, sessionStatus, email);
      if (destination.path === AUTH_PATHS.signIn) {
        const state: AuthLocationState = {
          email: destination.email,
          notice: destination.notice ?? undefined,
        };
        navigate(destination.path, { replace: true, state });
      } else {
        if (destination.notice && sessionStatus === 'signed-in') {
          notify(AUTH_NOTICE_MESSAGES[destination.notice].signedIn, 'success');
        }
        navigate(destination.path, { replace: true });
      }
      onDone();
    },
    [navigate, notify, onDone],
  );

  const failed = useCallback(
    (error: AppError) =>
      setPhase({ step: 'failed', error, recovery: linkRecovery(link.mode, status, error) }),
    [link.mode, status],
  );

  useEffect(() => {
    if (status === 'checking' || phase.step !== 'checking' || inFlight.current) {
      return;
    }
    inFlight.current = true;
    const process = async () => {
      if (link.mode === 'verifyEmail') {
        const confirmed = await auth.confirmEmail(link.code);
        if (confirmed.ok) {
          leave('verifyEmail', statusAfterConfirmation(confirmed.value));
        } else {
          failed(confirmed.error);
        }
      } else if (link.mode === 'resetPassword') {
        const verified = await auth.verifyPasswordReset(link.code);
        if (verified.ok) {
          setPhase({ step: 'password', email: verified.value });
        } else {
          failed(verified.error);
        }
      } else {
        const recovered = await auth.recoverEmail(link.code);
        if (recovered.ok) {
          setPhase({ step: 'recovered' });
        } else {
          failed(recovered.error);
        }
      }
      inFlight.current = false;
    };
    void process();
  }, [auth, failed, leave, link, phase.step, status]);

  const savePassword = async (password: string, confirmation: string) => {
    if (phase.step !== 'password') {
      return;
    }
    setSaving(true);
    setPasswordError(null);
    const saved = await auth.resetPassword(link.code, password, confirmation);
    setSaving(false);
    if (saved.ok) {
      leave('resetPassword', status, phase.email);
    } else if (isLinkFailure(saved.error)) {
      failed(saved.error);
    } else {
      setPasswordError(errorMessage(saved.error));
    }
  };

  const resendVerification = async () => {
    setResent((await resend.run(auth.resendEmailVerification)) !== null);
  };

  const requestPasswordReset = () => {
    navigate(AUTH_PATHS.forgotPassword, { replace: true });
    onDone();
  };

  return {
    phase,
    status,
    retry: () => setPhase({ step: 'checking' }),
    finish: () => leave(link.mode, status),
    cancel: () => leave(null, status),
    password: { save: savePassword, saving, error: passwordError },
    resend: { run: resendVerification, pending: resend.pending, error: resend.error, sent: resent },
    requestPasswordReset,
  };
};
