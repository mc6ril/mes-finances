import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { Container } from '@/app/container';
import FinanceProvider from '@/ui/providers/FinanceProvider';
import PeriodProvider from '@/ui/providers/PeriodProvider';
import ToastProvider from '@/ui/providers/ToastProvider';
import { useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { useApplyTheme } from '@/hooks/useTheme';
import Button from '@/ui/design-system/Button';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';
import { errorMessage } from '@/ui/errorMessages';
import AppShell from '@/ui/layout/AppShell';
import BilanPage from '@/ui/pages/bilan/BilanPage';
import BudgetPage from '@/ui/pages/budget/BudgetPage';
import ComptePage from '@/ui/pages/compte/ComptePage';
import DashboardPage from '@/ui/pages/dashboard/DashboardPage';
import ObjectifsPage from '@/ui/pages/objectifs/ObjectifsPage';
import ParametresPage from '@/ui/pages/parametres/ParametresPage';
import PatrimoinePage from '@/ui/pages/patrimoine/PatrimoinePage';

const Gate = () => {
  const state = useFinanceState();
  const store = useFinanceStore();
  useApplyTheme();
  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <TriangleAlert className="h-8 w-8 text-amber-500" aria-hidden />
          <Title level={2}>Impossible d’ouvrir tes données</Title>
          <Text variant="muted">{state.error ? errorMessage(state.error) : ''}</Text>
          <Button variant="primary" onClick={() => void store.start()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
  if (state.status === 'loading' || !state.dataset) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-label="Chargement" />
      </div>
    );
  }
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/compte" element={<ComptePage />} />
        <Route path="/patrimoine" element={<PatrimoinePage />} />
        <Route path="/bilan" element={<BilanPage />} />
        <Route path="/objectifs" element={<ObjectifsPage />} />
        <Route path="/parametres" element={<ParametresPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

type AppProps = { container: Container };

const App = ({ container }: AppProps) => (
  <FinanceProvider container={container}>
    <ToastProvider>
      <PeriodProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </PeriodProvider>
    </ToastProvider>
  </FinanceProvider>
);

export default App;
