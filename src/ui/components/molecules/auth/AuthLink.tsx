import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { AuthLocationState } from '@/ui/routing/authPaths';

type AuthLinkProps = { to: string; children: ReactNode; email?: string };

export const AuthLink = ({ to, children, email }: AuthLinkProps) => (
  <Link
    to={to}
    state={email ? ({ email } satisfies AuthLocationState) : null}
    className="font-medium text-accent-ink underline-offset-2 hover:underline focus:outline-hidden focus-visible:underline"
  >
    {children}
  </Link>
);
