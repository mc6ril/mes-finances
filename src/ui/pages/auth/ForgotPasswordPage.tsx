import { ArrowLeft, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthAction, useAuthUseCases } from '@/hooks/useAuth';
import Button from '@/ui/design-system/Button';
import { Field, Input } from '@/ui/design-system/Field';
import Notice from '@/ui/design-system/Notice';
import Text from '@/ui/design-system/Text';
import AuthLayout from './AuthLayout';
import { AUTH_PATHS, AuthLink, emailFrom, type AuthLocationState } from './authParts';

const ForgotPasswordPage = () => {
  const auth = useAuthUseCases();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => emailFrom(location.state));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { pending, error, run } = useAuthAction();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = await run(() => auth.requestPasswordReset(email));
    if (address) {
      setSentTo(address);
    }
  };

  const backToSignIn = () =>
    navigate(AUTH_PATHS.signIn, { state: { email: sentTo ?? email } satisfies AuthLocationState });

  if (sentTo) {
    return (
      <AuthLayout title="Vérifie ta boîte mail" subtitle="Le lien de réinitialisation est en route.">
        <div className="flex flex-col gap-5">
          <Notice tone="success">
            Si un compte existe pour <strong className="font-semibold">{sentTo}</strong>, tu vas recevoir un
            lien pour choisir un nouveau mot de passe.
          </Notice>
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            <Text variant="small">
              Rien reçu d’ici quelques minutes ? Regarde dans les courriers indésirables ou vérifie l’adresse
              saisie.
            </Text>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full" onClick={backToSignIn}>
              Retour à la connexion
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setSentTo(null)}>
              Utiliser une autre adresse
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indique ton e-mail : on t’envoie un lien pour en choisir un nouveau."
      footer={
        <span className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <AuthLink to={AUTH_PATHS.signIn} email={email}>
            Retour à la connexion
          </AuthLink>
        </span>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="jean.d@exemple.fr"
            autoFocus
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          Envoyer le lien
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
