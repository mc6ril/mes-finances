import { useState, type FormEvent } from 'react';
import Button from '@/ui/components/atoms/Button';
import { PasswordInput } from '@/ui/components/atoms/form/PasswordInput';
import { Field } from '@/ui/components/molecules/form/Field';
import Notice from '@/ui/components/molecules/feedback/Notice';
import { MIN_PASSWORD_LENGTH } from '@/core/auth/validation';

type NewPasswordFormProps = {
  email: string;
  saving: boolean;
  error: string | null;
  onSubmit: (password: string, confirmation: string) => void;
};

/** Choix d'un nouveau mot de passe, ouvert depuis le lien « mot de passe oublié ». */
const NewPasswordForm = ({ email, saving, error, onSubmit }: NewPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(password, confirmation);
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      {/* Associe le mot de passe au bon compte dans le gestionnaire de mots de passe. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <Field label="Nouveau mot de passe" hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Confirmation du mot de passe">
        <PasswordInput value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" className="w-full" loading={saving}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
};

export default NewPasswordForm;
