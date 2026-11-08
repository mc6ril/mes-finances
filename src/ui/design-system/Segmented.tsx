import { cx } from './cx';

type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
};

const Segmented = <T extends string>({ value, options, onChange, label }: SegmentedProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800"
  >
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
            ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-600 dark:text-white'
            : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default Segmented;
