import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import type { SignUpForm } from '@/core/auth/model';
import { MIN_PASSWORD_LENGTH } from '@/core/auth/validation';
import { useAuthAction, useAuthUseCases } from '@/hooks/useAuth';
import Button from '@/ui/design-system/Button';
import { Field, Input, PasswordInput } from '@/ui/design-system/Field';
import Notice from '@/ui/design-system/Notice';
import AuthLayout from './AuthLayout';
import { AUTH_PATHS, AuthLink, Divider, emailFrom } from './authParts';
import GoogleButton from './GoogleButton';

const SignUpPage = () => {
  const auth = useAuthUseCases();
  const location = useLocation();
  const [values, setValues] = useState<SignUpForm>(() => ({
    displayName: '',
    email: emailFrom(location.state),
    password: '',
    confirmation: '',
  }));
  const form = useAuthAction();
  const google = useAuthAction();
  const busy = form.pending || google.pending;

  const set = (key: keyof SignUpForm) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    google.clearError();
    void form.run(() => auth.signUp(values));
  };

  const signInWithGoogle = () => {
    form.clearError();
    void google.run(auth.signInWithGoogle);
  };

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Un compte chacun pour suivre vos finances à deux."
      footer={
        <>
          Déjà un compte ?{' '}
          <AuthLink to={AUTH_PATHS.signIn} email={values.email}>
            Se connecter
          </AuthLink>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <GoogleButton onClick={signInWithGoogle} loading={google.pending} disabled={busy} />
        <Divider />
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Field label="Prénom">
            <Input
              value={values.displayName}
              onChange={set('displayName')}
              autoComplete="given-name"
              placeholder="Jean"
              autoFocus
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={values.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="jean.d@exemple.fr"
            />
          </Field>
          <Field label="Mot de passe" hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}>
            <PasswordInput value={values.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Confirmation du mot de passe">
            <PasswordInput
              value={values.confirmation}
              onChange={set('confirmation')}
              autoComplete="new-password"
            />
          </Field>
          {(form.error ?? google.error) && <Notice tone="error">{form.error ?? google.error}</Notice>}
          <Button type="submit" variant="primary" className="w-full" loading={form.pending} disabled={busy}>
            Créer mon compte
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default SignUpPage;
