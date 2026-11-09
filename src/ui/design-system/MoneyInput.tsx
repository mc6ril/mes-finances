import { useState } from 'react';
import { parseEuros } from '@/core/shared/money';
import type { Cents } from '@/core/shared/model';
import { cx } from './cx';

type MoneyInputProps = {
  cents: Cents;
  onCommit: (cents: Cents) => void;
  label: string;
  className?: string;
  allowNegative?: boolean;
};

const toText = (cents: Cents): string => {
  if (cents === 0) {
    return '';
  }
  return (cents / 100).toFixed(2).replace('.', ',').replace(',00', '');
};

const MoneyInput = ({ cents, onCommit, label, className, allowNegative = false }: MoneyInputProps) => {
  const [text, setText] = useState(toText(cents));
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    if (text.trim() === '') {
      setInvalid(false);
      onCommit(0);
      return;
    }
    const parsed = parseEuros(text);
    if (parsed === null || (!allowNegative && parsed < 0)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(toText(parsed));
    onCommit(parsed);
  };
  return (
    <div className={cx('relative', className)}>
      <input
        value={text}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid}
        placeholder="0"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className={cx(
          'h-9 w-full rounded-lg border bg-white pl-2.5 pr-6 text-right text-sm tabular-nums text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:bg-stone-900 dark:text-stone-100',
          invalid ? 'border-red-400' : 'border-stone-200 focus:border-brand-500 dark:border-stone-700',
        )}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
        €
      </span>
    </div>
  );
};

export default MoneyInput;
