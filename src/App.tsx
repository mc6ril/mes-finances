import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { Container } from '@/app/container';
import FinanceProvider from '@/ui/providers/FinanceProvider';
import PeriodProvider from '@/ui/providers/PeriodProvider';
import BackupHistoryProvider from '@/ui/providers/BackupHistoryProvider';
import ToastProvider from '@/ui/providers/ToastProvider';
import type { ReactNode } from 'react';
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
import BilanPage from '@/ui/pages/bilan/BilanPage';
import BudgetPage from '@/ui/pages/budget/BudgetPage';
import InvitationPage from '@/ui/pages/invitation/InvitationPage';
import RememberInvitation from '@/ui/pages/invitation/RememberInvitation';
import ComptePage from '@/ui/pages/compte/ComptePage';
import DashboardPage from '@/ui/pages/dashboard/DashboardPage';
import ObjectifsPage from '@/ui/pages/objectifs/ObjectifsPage';
import ParametresPage from '@/ui/pages/parametres/ParametresPage';
import PatrimoinePage from '@/ui/pages/patrimoine/PatrimoinePage';

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
