import { MailCheck, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAuthAction, useAuthUseCases, useCurrentUser } from '@/hooks/useAuth';
import Button from '@/ui/design-system/Button';
import Notice from '@/ui/design-system/Notice';
import Text from '@/ui/design-system/Text';
import AuthLayout from './AuthLayout';

/** Affiché tant qu'un compte par e-mail n'a pas confirmé son adresse. */
const VerifyEmailPage = () => {
  const auth = useAuthUseCases();
  const user = useCurrentUser();
  const confirm = useAuthAction();
  const resend = useAuthAction();
  const signOut = useAuthAction();
  const [resent, setResent] = useState(false);
  const busy = confirm.pending || resend.pending || signOut.pending;
  const error = confirm.error ?? resend.error ?? signOut.error;

  const clearErrors = () => {
    confirm.clearError();
    resend.clearError();
    signOut.clearError();
  };

  const checkConfirmation = () => {
    clearErrors();
    setResent(false);
    void confirm.run(auth.confirmEmailVerified);
  };

  const resendEmail = async () => {
    clearErrors();
    setResent((await resend.run(auth.resendEmailVerification)) !== null);
  };

  const useAnotherAccount = () => {
    clearErrors();
    void signOut.run(auth.signOut);
  };

  return (
    <AuthLayout
      title="Confirme ton adresse"
      subtitle="Une dernière étape pour protéger tes comptes."
      footer={
        <button
          type="button"
          onClick={useAnotherAccount}
          disabled={busy}
          className="font-medium text-brand-600 underline-offset-2 hover:underline focus:outline-hidden focus-visible:underline disabled:opacity-60 dark:text-brand-300"
        >
          Utiliser un autre compte
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 dark:bg-brand-500/10">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
          <Text>
            Un lien de confirmation a été envoyé à{' '}
            <strong className="font-semibold text-stone-900 dark:text-stone-50">{user.email}</strong>. Clique
            dessus, puis reviens ici.
          </Text>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {resent && !error && (
          <Notice tone="success">E-mail renvoyé. Pense à regarder dans les indésirables.</Notice>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={checkConfirmation}
            loading={confirm.pending}
            disabled={busy}
          >
            J’ai confirmé mon adresse
          </Button>
          <Button
            variant="ghost"
            icon={RefreshCw}
            className="w-full"
            onClick={() => void resendEmail()}
            loading={resend.pending}
            disabled={busy}
          >
            Renvoyer l’e-mail
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
