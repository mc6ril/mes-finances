import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { FinanceStore } from '@/app/FinanceStore';
import {
  FinanceProvider,
  PeriodProvider,
  ToastProvider,
  useFinanceState,
  useFinanceStore,
} from '@/app/FinanceContext';
import { useApplyTheme } from '@/app/theme';
import Button from '@/ui/design-system/Button';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';
import { errorMessage } from '@/ui/errorMessages';
import AppShell from '@/ui/layout/AppShell';
import BilanPage from '@/ui/pages/BilanPage';
import BudgetPage from '@/ui/pages/BudgetPage';
import ComptePage from '@/ui/pages/ComptePage';
import DashboardPage from '@/ui/pages/DashboardPage';
import ObjectifsPage from '@/ui/pages/ObjectifsPage';
import ParametresPage from '@/ui/pages/ParametresPage';
import PatrimoinePage from '@/ui/pages/PatrimoinePage';

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

type AppProps = { store: FinanceStore };

const App = ({ store }: AppProps) => (
  <FinanceProvider store={store}>
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
