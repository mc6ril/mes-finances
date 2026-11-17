import type { AuthActionLink, AuthActionMode } from '@/core/auth/actionLink';
import { isLinkFailure } from '@/hooks/auth/authActionLink';
import { useAuthActionLink } from '@/hooks/auth/useAuthActionLink';
import Button from '@/ui/components/atoms/Button';
import PageLoader from '@/ui/components/atoms/PageLoader';
import Text from '@/ui/components/atoms/Text';
import { AuthTextButton } from '@/ui/components/molecules/auth/AuthTextButton';
import Notice from '@/ui/components/molecules/feedback/Notice';
import AuthLinkProblem from '@/ui/components/organisms/auth/AuthLinkProblem';
import NewPasswordForm from '@/ui/components/organisms/auth/NewPasswordForm';
import AuthLayout from '@/ui/components/templates/AuthLayout';
import { errorMessage } from '@/ui/errorMessages';

const CHECKING_TITLES: Record<AuthActionMode, string> = {
  verifyEmail: 'Confirmation de ton adresse…',
  resetPassword: 'Vérification du lien…',
  recoverEmail: 'Rétablissement de ton adresse…',
};

type AuthActionPageProps = { link: AuthActionLink; onDone: () => void };

/** Lien reçu par e-mail (confirmation d'adresse, mot de passe oublié…), traité par l'application. */
const AuthActionPage = ({ link, onDone }: AuthActionPageProps) => {
  const action = useAuthActionLink(link, onDone);
  const { phase } = action;

  if (phase.step === 'password') {
    return (
      <AuthLayout
        title="Nouveau mot de passe"
        subtitle={`Choisis le nouveau mot de passe du compte ${phase.email}.`}
        footer={
          <AuthTextButton onClick={action.cancel} disabled={action.password.saving}>
            Annuler
          </AuthTextButton>
        }
      >
        <NewPasswordForm
          email={phase.email}
          saving={action.password.saving}
          error={action.password.error}
          onSubmit={(password, confirmation) => void action.password.save(password, confirmation)}
        />
      </AuthLayout>
    );
  }

  if (phase.step === 'recovered') {
    return (
      <AuthLayout title="Adresse rétablie" subtitle="Le changement d’adresse a été annulé.">
        <div className="flex flex-col gap-5">
          <Notice tone="success">Ton adresse de connexion d’origine a été rétablie.</Notice>
          <Text variant="small">
            Si tu n’es pas à l’origine de ce changement, choisis aussi un nouveau mot de passe depuis « Mot de
            passe oublié ».
          </Text>
          <Button variant="primary" className="w-full" onClick={action.finish}>
            Continuer
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (phase.step === 'failed') {
    const linkUnusable = isLinkFailure(phase.error);
    return (
      <AuthLayout
        title={linkUnusable ? 'Lien inutilisable' : 'Le lien n’a pas pu être traité'}
        subtitle={linkUnusable ? 'Ce lien ne peut plus servir.' : 'Un problème est survenu.'}
      >
        <AuthLinkProblem
          message={errorMessage(phase.error)}
          recovery={phase.recovery}
          retryable={!linkUnusable}
          signedOut={action.status === 'signed-out'}
          resend={action.resend}
          onRetry={action.retry}
          onResend={() => void action.resend.run()}
          onRequestPasswordReset={action.requestPasswordReset}
          onContinue={action.cancel}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={CHECKING_TITLES[link.mode]} subtitle="Un instant.">
      <PageLoader />
    </AuthLayout>
  );
};

export default AuthActionPage;
