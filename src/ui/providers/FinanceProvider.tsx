import type { ReactNode } from 'react';
import type { Container } from '@/app/container';
import { ContainerContext } from './contexts';

type FinanceProviderProps = { container: Container; children: ReactNode };

const FinanceProvider = ({ container, children }: FinanceProviderProps) => (
  <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
);

export default FinanceProvider;
