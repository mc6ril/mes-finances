import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from './Input';

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  autoFocus?: boolean;
};

export const PasswordInput = ({
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-faint transition-colors hover:text-ink-body focus:outline-hidden focus-visible:text-accent"
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};
