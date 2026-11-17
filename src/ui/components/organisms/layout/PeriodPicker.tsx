import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  isCurrentPeriod,
  type PeriodMode,
  parseMonthKey,
  periodToday,
  stepPeriod,
} from '@/core/shared/dates';
import { capitalize, monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import { usePeriod } from '@/hooks/usePeriod';
import Button from '@/ui/components/atoms/Button';

const LABELS: Record<PeriodMode, (month: MonthKey) => string> = {
  month: (month) => capitalize(monthLabel(month)),
  year: (month) => String(parseMonthKey(month).year),
};

type PeriodPickerProps = { mode: PeriodMode };

const PeriodPicker = ({ mode }: PeriodPickerProps) => {
  const { month, setMonth, currentMonth } = usePeriod();
  const label = LABELS[mode](month);
  const isCurrent = isCurrentPeriod(month, currentMonth, mode);
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onClick={() => setMonth(stepPeriod(month, mode, -1))}
        label="Période précédente"
      />
      <label className="relative">
        <span className="sr-only">Choisir la période</span>
        <span className="block min-w-[120px] rounded-lg px-2 py-1 text-center text-sm font-semibold text-ink-strong hover:bg-surface-muted">
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
        onClick={() => setMonth(stepPeriod(month, mode, 1))}
        label="Période suivante"
      />
      {!isCurrent && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(periodToday(month, currentMonth, mode))}
        >
          Aujourd’hui
        </Button>
      )}
    </div>
  );
};

export default PeriodPicker;
