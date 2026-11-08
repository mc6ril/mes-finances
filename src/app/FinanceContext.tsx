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
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { databaseNameFor, LocalWorkspaceRegistry } from '@/adapters/storage/workspaceRegistry';
import { monthKeyOf, todayIso } from '@/core/dates';
import type { Dataset, MonthKey } from '@/core/model';
import { FinanceStore, type StoreState } from './FinanceStore';

const fallbackId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackId();
};

const repositoryFor = (workspaceId: string) => new IndexedDbRepository(databaseNameFor(workspaceId));

const StoreContext = createContext<FinanceStore | null>(null);

export const createFinanceStore = (): FinanceStore =>
  new FinanceStore(repositoryFor, new LocalWorkspaceRegistry(), newId);

type FinanceProviderProps = { store: FinanceStore; children: ReactNode };

export const FinanceProvider = ({ store, children }: FinanceProviderProps) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);

export const useFinanceStore = (): FinanceStore => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('FinanceProvider manquant');
  }
  return store;
};

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
