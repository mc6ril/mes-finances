import type { ReactNode } from 'react';

type AuthTextButtonProps = { onClick: () => void; disabled?: boolean; children: ReactNode };

/** Action secondaire en bas des écrans de connexion, présentée comme un lien. */
export const AuthTextButton = ({ onClick, disabled, children }: AuthTextButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="font-medium text-accent-ink underline-offset-2 hover:underline focus:outline-hidden focus-visible:underline disabled:opacity-60"
  >
    {children}
  </button>
);
