import { PiggyBank, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';
import { APP_VERSION } from '@/ui/constants';
import Brand from '@/ui/layout/Brand';

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UsersRound, title: 'À deux', text: 'Chacun son compte, un suivi commun partagé.' },
  { icon: PiggyBank, title: 'Tout au même endroit', text: 'Budget, compte commun, épargne et objectifs.' },
  {
    icon: ShieldCheck,
    title: 'Sans connexion bancaire',
    text: 'Vous choisissez ce que vous saisissez ou importez.',
  },
];

/** Courbe décorative du panneau de marque. */
const Curve = () => (
  <svg
    viewBox="0 0 400 160"
    preserveAspectRatio="none"
    className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full"
    aria-hidden
  >
    <path
      d="M0 130 C50 120 70 90 110 96 S170 128 210 100 S280 40 320 52 S380 30 400 18 L400 160 L0 160 Z"
      className="fill-white/10"
    />
    <path
      d="M0 130 C50 120 70 90 110 96 S170 128 210 100 S280 40 320 52 S380 30 400 18"
      className="fill-none stroke-white/40"
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

const BrandPanel = () => (
  <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-600 to-brand-800 p-10 text-white lg:flex lg:flex-col dark:from-brand-800 dark:to-brand-900">
    <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
    <Brand inverted className="px-0" />
    <div className="relative mt-auto mb-auto flex max-w-md flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">Les finances du foyer, à deux.</h2>
        <p className="text-sm text-white/75">
          Retrouvez vos comptes sur chacun de vos appareils et suivez ensemble le budget commun.
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-white/70">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
    <p className="relative text-[11px] text-white/60">Version {APP_VERSION}</p>
    <Curve />
  </aside>
);

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

const AuthLayout = ({ title, subtitle, children, footer }: AuthLayoutProps) => (
  <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <BrandPanel />
    <main className="flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-7 animate-in">
        <Brand className="px-0 lg:hidden" />
        <header className="flex flex-col gap-1.5">
          <Title level={1}>{title}</Title>
          <Text variant="muted">{subtitle}</Text>
        </header>
        {children}
        {footer && (
          <Text variant="muted" className="text-center">
            {footer}
          </Text>
        )}
      </div>
    </main>
  </div>
);

export default AuthLayout;
