import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePeriod } from '@/hooks/usePeriod';
import { addMonths, parseMonthKey, toMonthKey } from '@/core/dates';
import { capitalize, monthLabel } from '@/core/format';
import type { MonthKey } from '@/core/model';
import Button from '@/ui/design-system/Button';

type PickerMode = 'month' | 'year';

type ModeBehaviour = {
  step: number;
  label: (month: MonthKey) => string;
  isCurrent: (month: MonthKey, current: MonthKey) => boolean;
  reset: (month: MonthKey, current: MonthKey) => MonthKey;
};

const BEHAVIOURS: Record<PickerMode, ModeBehaviour> = {
  month: {
    step: 1,
    label: (month) => capitalize(monthLabel(month)),
    isCurrent: (month, current) => month === current,
    reset: (_, current) => current,
  },
  year: {
    step: 12,
    label: (month) => String(parseMonthKey(month).year),
    isCurrent: (month, current) => parseMonthKey(month).year === parseMonthKey(current).year,
    reset: (month, current) => toMonthKey(parseMonthKey(current).year, parseMonthKey(month).month),
  },
};

type PeriodPickerProps = { mode: PickerMode };

const PeriodPicker = ({ mode }: PeriodPickerProps) => {
  const { month, setMonth, currentMonth } = usePeriod();
  const behaviour = BEHAVIOURS[mode];
  const step = behaviour.step;
  const label = behaviour.label(month);
  const isCurrent = behaviour.isCurrent(month, currentMonth);
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onClick={() => setMonth(addMonths(month, -step))}
        label="Période précédente"
      />
      <label className="relative">
        <span className="sr-only">Choisir la période</span>
        <span className="block min-w-[120px] rounded-lg px-2 py-1 text-center text-sm font-semibold text-stone-900 hover:bg-stone-100 dark:text-stone-50 dark:hover:bg-stone-800">
          {label}
        </span>
        <input
          type="month"
          value={month}
          onChange={(event) => {
            if (event.target.value) {
              setMonth(event.target.value);
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Choisir le mois"
        />
      </label>
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronRight}
        onClick={() => setMonth(addMonths(month, step))}
        label="Période suivante"
      />
      {!isCurrent && (
        <Button variant="secondary" size="sm" onClick={() => setMonth(behaviour.reset(month, currentMonth))}>
          Aujourd’hui
        </Button>
      )}
    </div>
  );
};

export default PeriodPicker;
