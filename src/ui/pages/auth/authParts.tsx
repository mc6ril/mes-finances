import type { ReactNode } from 'react';
import { Link } from 'react-router';

export const AUTH_PATHS = {
  signIn: '/connexion',
  signUp: '/inscription',
  forgotPassword: '/mot-de-passe-oublie',
} as const;

/** E-mail saisi transmis d'un écran à l'autre (connexion → mot de passe oublié…). */
export type AuthLocationState = { email?: string } | null;

export const emailFrom = (state: unknown): string =>
  typeof state === 'object' && state !== null && 'email' in state && typeof state.email === 'string'
    ? state.email
    : '';

export const Divider = () => (
  <div className="flex items-center gap-3" role="separator">
    <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
    <span className="text-xs text-stone-400 dark:text-stone-500">ou</span>
    <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
  </div>
);

type AuthLinkProps = { to: string; children: ReactNode; email?: string };

export const AuthLink = ({ to, children, email }: AuthLinkProps) => (
  <Link
    to={to}
    state={email ? ({ email } satisfies AuthLocationState) : null}
    className="font-medium text-brand-600 underline-offset-2 hover:underline focus:outline-hidden focus-visible:underline dark:text-brand-300"
  >
    {children}
  </Link>
);
