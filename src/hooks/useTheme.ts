import { useLayoutEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  chartThemeOf,
  type ResolvedTheme,
  resolveTheme,
  subscribeToScheme,
  systemPrefersDark,
} from '@/ui/theme';
import { useFinanceState } from './useFinance';

export const useResolvedTheme = (): ResolvedTheme => {
  const systemDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark);
  const { dataset } = useFinanceState();
  return resolveTheme(dataset?.settings.theme ?? 'system', systemDark);
};

export const useApplyTheme = (): void => {
  const theme = useResolvedTheme();
  useLayoutEffect(() => applyTheme(theme), [theme]);
};

export const useChartTheme = () => chartThemeOf(useResolvedTheme());
