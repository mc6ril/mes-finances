import { cx } from './cx';

type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
};

const Segmented = <T extends string>({ value, options, onChange, label }: SegmentedProps<T>) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface-muted p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        onClick={() => onChange(option.value)}
        className={cx(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          option.value === value
            ? 'bg-surface-thumb text-ink-max shadow-xs'
            : 'text-ink-subtle hover:text-ink-emphasis',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default Segmented;
