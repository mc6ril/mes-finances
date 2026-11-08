import { useMemo } from 'react';
import { monthOverview } from '@/app/selectors';
import type { Dataset, IsoDate, MonthKey } from '@/core/model';

export const useMonthOverview = (dataset: Dataset, month: MonthKey, today: IsoDate) =>
  useMemo(() => monthOverview(dataset, month, today), [dataset, month, today]);
