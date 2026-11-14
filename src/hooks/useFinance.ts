import { useContext, useSyncExternalStore } from 'react';
import type { Container } from '@/app/container';
import type { FinanceStore, StoreState } from '@/core/store/FinanceStore';
import type { Dataset } from '@/core/shared/model';
import { ContainerContext } from '@/ui/providers/contexts';

export const useContainer = (): Container => {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error('FinanceProvider manquant');
  }
  return container;
};

export const useFinanceStore = (): FinanceStore => useContainer().store;

export const useFileUseCases = () => useContainer().files;

export const useFinanceUseCases = () => useContainer().finance;

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
