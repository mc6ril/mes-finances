import { useMemo, useState, type ReactNode } from 'react';
import { monthKeyOf } from '@/core/shared/dates';
import type { MonthKey } from '@/core/shared/model';
import { useToday } from '@/hooks/useToday';
import { PeriodContext } from './contexts';

type PeriodProviderProps = { children: ReactNode };

const PeriodProvider = ({ children }: PeriodProviderProps) => {
  const today = useToday();
  const currentMonth = monthKeyOf(today);
  const [month, setMonth] = useState<MonthKey>(currentMonth);
  const value = useMemo(() => ({ month, setMonth, today, currentMonth }), [month, today, currentMonth]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
};

export default PeriodProvider;
