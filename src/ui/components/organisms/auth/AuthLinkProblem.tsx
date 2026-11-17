import { RefreshCw } from 'lucide-react';
import Button from '@/ui/components/atoms/Button';
import Notice from '@/ui/components/molecules/feedback/Notice';
import type { LinkRecovery } from '@/hooks/auth/authActionLink';

type AuthLinkProblemProps = {
  message: string;
  recovery: LinkRecovery;
  /** Erreur passagère (réseau…) : le même lien peut être réessayé. */
  retryable: boolean;
  signedOut: boolean;
  resend: { pending: boolean; error: string | null; sent: boolean };
  onRetry: () => void;
  onResend: () => void;
  onRequestPasswordReset: () => void;
  onContinue: () => void;
};

/** Lien expiré, déjà utilisé, invalide, ou erreur pendant son traitement, avec la solution possible. */
const AuthLinkProblem = ({
  message,
  recovery,
  retryable,
  signedOut,
  resend,
  onRetry,
  onResend,
  onRequestPasswordReset,
  onContinue,
}: AuthLinkProblemProps) => (
  <div className="flex flex-col gap-5">
    <Notice tone="error">{resend.error ?? message}</Notice>
    {resend.sent && !resend.error && (
      <Notice tone="success">E-mail renvoyé. Pense à regarder dans les indésirables.</Notice>
    )}
    <div className="flex flex-col gap-2">
      {retryable && (
        <Button variant="primary" className="w-full" onClick={onRetry}>
          Réessayer
        </Button>
      )}
      {!retryable && recovery === 'resend-verification' && (
        <Button
          variant="primary"
          icon={RefreshCw}
          className="w-full"
          onClick={onResend}
          loading={resend.pending}
        >
          Renvoyer l’e-mail
        </Button>
      )}
      {!retryable && recovery === 'request-password-reset' && (
        <Button variant="primary" className="w-full" onClick={onRequestPasswordReset}>
          Demander un nouveau lien
        </Button>
      )}
      <Button variant="ghost" className="w-full" onClick={onContinue} disabled={resend.pending}>
        {signedOut ? 'Aller à la connexion' : 'Continuer'}
      </Button>
    </div>
  </div>
);

export default AuthLinkProblem;
