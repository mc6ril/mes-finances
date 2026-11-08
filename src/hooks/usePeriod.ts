import { useContext } from 'react';
import { PeriodContext, type PeriodValue } from '@/ui/providers/contexts';

export const usePeriod = (): PeriodValue => {
  const value = useContext(PeriodContext);
  if (!value) {
    throw new Error('PeriodProvider manquant');
  }
  return value;
};
