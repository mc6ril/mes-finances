import { useMemo } from 'react';
import { spendingSlices } from '@/app/selectors';
import type { Dataset, MonthKey } from '@/core/model';

export const useSpendingSlices = (dataset: Dataset, month: MonthKey) =>
  useMemo(() => spendingSlices(dataset, month), [dataset, month]);
