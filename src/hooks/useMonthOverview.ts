import { useMemo } from 'react';
import { monthOverview } from '@/core/overview';
import type { Dataset, IsoDate, MonthKey } from '@/core/model';

export const useMonthOverview = (dataset: Dataset, month: MonthKey, today: IsoDate) =>
  useMemo(() => monthOverview(dataset, month, today), [dataset, month, today]);
