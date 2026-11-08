import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { randomId } from '@/adapters/ids/randomIdGenerator';
import { monthKeyOf, todayIso } from '@/core/dates';
import type { Dataset, MonthKey } from '@/core/model';
import type { Container } from './container';
import type { FinanceStore, StoreState } from './FinanceStore';

const ContainerContext = createContext<Container | null>(null);

type FinanceProviderProps = { container: Container; children: ReactNode };

export const FinanceProvider = ({ container, children }: FinanceProviderProps) => (
  <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
);

const useContainer = (): Container => {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error('FinanceProvider manquant');
  }
  return container;
};

export const useFileUseCases = () => useContainer().files;

export const newId = (): string => randomId();

export const useFinanceStore = (): FinanceStore => useContainer().store;

export const useFinanceState = (): StoreState => {
  const store = useFinanceStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
};

export const useDataset = (): Dataset => {
  const { dataset } = useFinanceState();
  if (!dataset) {
    throw new Error('Données non chargées');
  }
  return dataset;
};

type PeriodValue = {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  today: string;
  currentMonth: MonthKey;
};

const PeriodContext = createContext<PeriodValue | null>(null);

type PeriodProviderProps = { children: ReactNode };

const useToday = (): string => {
  const [today, setToday] = useState(todayIso);
  useEffect(() => {
    const update = () => setToday(todayIso());
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        update();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
};

export const PeriodProvider = ({ children }: PeriodProviderProps) => {
  const today = useToday();
  const currentMonth = monthKeyOf(today);
  const [month, setMonth] = useState<MonthKey>(currentMonth);
  const value = useMemo(() => ({ month, setMonth, today, currentMonth }), [month, today, currentMonth]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
};

export const usePeriod = (): PeriodValue => {
  const value = useContext(PeriodContext);
  if (!value) {
    throw new Error('PeriodProvider manquant');
  }
  return value;
};

export type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };
type ToastValue = {
  toasts: Toast[];
  notify: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

type ToastProviderProps = { children: ReactNode };

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );
  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastValue => {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('ToastProvider manquant');
  }
  return value;
};
