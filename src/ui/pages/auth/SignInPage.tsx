import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { useAuthAction, useAuthUseCases } from '@/hooks/useAuth';
import Button from '@/ui/components/atoms/Button';
import { Field } from '@/ui/components/molecules/form/Field';
import { Input } from '@/ui/components/atoms/form/Input';
import { PasswordInput } from '@/ui/components/atoms/form/PasswordInput';
import Notice from '@/ui/components/molecules/feedback/Notice';
import AuthLayout from '@/ui/components/templates/AuthLayout';
import { AUTH_PATHS, emailFrom, noticeFrom } from '@/ui/routing/authPaths';
import { AUTH_NOTICE_MESSAGES } from '@/hooks/auth/authActionLink';
import { AuthLink } from '@/ui/components/molecules/auth/AuthLink';
import { Divider } from '@/ui/components/atoms/Divider';
import GoogleButton from '@/ui/components/molecules/auth/GoogleButton';

const SignInPage = () => {
  const auth = useAuthUseCases();
  const location = useLocation();
  const [email, setEmail] = useState(() => emailFrom(location.state));
  const [password, setPassword] = useState('');
  const notice = noticeFrom(location.state);
  const form = useAuthAction();
  const google = useAuthAction();
  const busy = form.pending || google.pending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    google.clearError();
    void form.run(() => auth.signIn({ email, password }));
  };

  const signInWithGoogle = () => {
    form.clearError();
    void google.run(auth.signInWithGoogle);
  };

  return (
    <AuthLayout
      title="Bonjour !"
      subtitle="Connecte-toi pour retrouver tes comptes."
      footer={
        <>
          Pas encore de compte ?{' '}
          <AuthLink to={AUTH_PATHS.signUp} email={email}>
            Créer un compte
          </AuthLink>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {notice && <Notice tone="success">{AUTH_NOTICE_MESSAGES[notice].signedOut}</Notice>}
        <GoogleButton onClick={signInWithGoogle} loading={google.pending} disabled={busy} />
        <Divider />
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
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
          <div className="flex flex-col gap-1.5">
            <Field label="Mot de passe">
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
            </Field>
            <div className="flex justify-end text-xs">
              <AuthLink to={AUTH_PATHS.forgotPassword} email={email}>
                Mot de passe oublié ?
              </AuthLink>
            </div>
          </div>
          {(form.error ?? google.error) && <Notice tone="error">{form.error ?? google.error}</Notice>}
          <Button type="submit" variant="primary" className="w-full" loading={form.pending} disabled={busy}>
            Se connecter
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default SignInPage;
