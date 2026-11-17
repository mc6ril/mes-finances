import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { Container } from '@/app/container';
import FinanceProvider from '@/ui/providers/FinanceProvider';
import PeriodProvider from '@/ui/providers/PeriodProvider';
import BackupHistoryProvider from '@/ui/providers/BackupHistoryProvider';
import ToastProvider from '@/ui/providers/ToastProvider';
import { Suspense, useEffect, type ReactNode } from 'react';
import { useAuthState } from '@/hooks/useAuth';
import { useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { INVITATION_PATH, usePendingInvitation } from '@/hooks/useSharing';
import { useApplyTheme } from '@/hooks/useTheme';
import Button from '@/ui/design-system/Button';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';
import { errorMessage } from '@/ui/errorMessages';
import AppShell from '@/ui/layout/AppShell';
import { AUTH_PATHS } from '@/ui/pages/auth/authParts';
import ForgotPasswordPage from '@/ui/pages/auth/ForgotPasswordPage';
import SignInPage from '@/ui/pages/auth/SignInPage';
import SignUpPage from '@/ui/pages/auth/SignUpPage';
import VerifyEmailPage from '@/ui/pages/auth/VerifyEmailPage';
import RememberInvitation from '@/ui/pages/invitation/RememberInvitation';
import { lazyPage } from '@/ui/lazyPage';

// Pages de l'application chargées à la demande : l'écran de connexion n'embarque ni elles ni recharts.
const pages = {
  dashboard: lazyPage(() => import('@/ui/pages/dashboard/DashboardPage')),
  budget: lazyPage(() => import('@/ui/pages/budget/BudgetPage')),
  compte: lazyPage(() => import('@/ui/pages/compte/ComptePage')),
  patrimoine: lazyPage(() => import('@/ui/pages/patrimoine/PatrimoinePage')),
  bilan: lazyPage(() => import('@/ui/pages/bilan/BilanPage')),
  objectifs: lazyPage(() => import('@/ui/pages/objectifs/ObjectifsPage')),
  parametres: lazyPage(() => import('@/ui/pages/parametres/ParametresPage')),
  invitation: lazyPage(() => import('@/ui/pages/invitation/InvitationPage')),
};

const DashboardPage = pages.dashboard.Page;
const BudgetPage = pages.budget.Page;
const ComptePage = pages.compte.Page;
const PatrimoinePage = pages.patrimoine.Page;
const BilanPage = pages.bilan.Page;
const ObjectifsPage = pages.objectifs.Page;
const ParametresPage = pages.parametres.Page;
const InvitationPage = pages.invitation.Page;

/** Page de l'adresse ouverte (« /parametres/xxx » compris), le tableau de bord sinon. */
const pageForPath = (pathname: string) => {
  const segment = pathname.split('/')[1] ?? '';
  if (`/${segment}` === INVITATION_PATH) {
    return pages.invitation;
  }
  return Object.hasOwn(pages, segment) ? pages[segment as keyof typeof pages] : pages.dashboard;
};

/**
 * Télécharge la page de l'adresse pendant l'ouverture des données, puis toutes les autres une
 * fois l'application affichée : la navigation reste immédiate, hors ligne compris.
 */
const usePreloadPages = (ready: boolean) => {
  const { pathname } = useLocation();
  useEffect(() => {
    void pageForPath(pathname).preload();
  }, [pathname]);
  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = window.setTimeout(() => Object.values(pages).forEach((page) => void page.preload()), 1500);
    return () => window.clearTimeout(timer);
  }, [ready]);
};

const PageLoader = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-label="Chargement" />
  </div>
);

const FullScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-label="Chargement" />
  </div>
);

type FullScreenErrorProps = { title: string; message: string; action?: ReactNode };

const FullScreenError = ({ title, message, action }: FullScreenErrorProps) => (
  <div className="flex min-h-screen items-center justify-center p-6">
    <div className="flex max-w-md flex-col items-center gap-3 text-center">
      <TriangleAlert className="h-8 w-8 text-amber-500" aria-hidden />
      <Title level={2}>{title}</Title>
      <Text variant="muted">{message}</Text>
      {action}
    </div>
  </div>
);

const AuthRoutes = () => (
  <Routes>
    <Route path={AUTH_PATHS.signIn} element={<SignInPage />} />
    <Route path={AUTH_PATHS.signUp} element={<SignUpPage />} />
    <Route path={AUTH_PATHS.forgotPassword} element={<ForgotPasswordPage />} />
    <Route path={`${INVITATION_PATH}/:token`} element={<RememberInvitation />} />
    <Route path="*" element={<Navigate to={AUTH_PATHS.signIn} replace />} />
  </Routes>
);

const Gate = () => {
  const state = useFinanceState();
  const store = useFinanceStore();
  const navigate = useNavigate();
  usePendingInvitation(navigate);
  usePreloadPages(state.status !== 'loading' && state.status !== 'error' && Boolean(state.dataset));
  if (state.status === 'error') {
    return (
      <FullScreenError
        title="Impossible d’ouvrir tes données"
        message={state.error ? errorMessage(state.error) : ''}
        action={
          <Button variant="primary" onClick={() => void store.start()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (state.status === 'loading' || !state.dataset) {
    return <FullScreenLoader />;
  }
  return (
    <BackupHistoryProvider>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/compte" element={<ComptePage />} />
            <Route path="/patrimoine" element={<PatrimoinePage />} />
            <Route path="/bilan" element={<BilanPage />} />
            <Route path="/objectifs" element={<ObjectifsPage />} />
            <Route path="/parametres" element={<ParametresPage />} />
            <Route path="/parametres/:tab" element={<ParametresPage />} />
            <Route path={`${INVITATION_PATH}/:token`} element={<InvitationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BackupHistoryProvider>
  );
};

const AuthGate = () => {
  const { status, error } = useAuthState();
  useApplyTheme();
  if (status === 'checking') {
    return <FullScreenLoader />;
  }
  if (status === 'unavailable') {
    return <FullScreenError title="Connexion indisponible" message={error ? errorMessage(error) : ''} />;
  }
  if (status === 'signed-out') {
    return <AuthRoutes />;
  }
  if (status === 'unverified') {
    return <VerifyEmailPage />;
  }
  return <Gate />;
};

type AppProps = { container: Container };

const App = ({ container }: AppProps) => (
  <FinanceProvider container={container}>
    <ToastProvider>
      <PeriodProvider>
        <HashRouter>
          <AuthGate />
        </HashRouter>
      </PeriodProvider>
    </ToastProvider>
  </FinanceProvider>
);

export default App;
