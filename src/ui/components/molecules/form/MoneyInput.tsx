import { useState } from 'react';
import type { Cents } from '@/core/shared/model';
import { centsToInput, parseEuros } from '@/core/shared/money';
import { cx } from '@/ui/design-system/cx';

type MoneyInputProps = {
  cents: Cents;
  onCommit: (cents: Cents) => void;
  label: string;
  className?: string;
  allowNegative?: boolean;
};

/** Montant affiché dans le champ : vide pour zéro, sans « ,00 » pour un montant rond. */
const toText = (cents: Cents): string => centsToInput(cents, { compact: true, blankZero: true });

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
          'h-9 w-full rounded-lg border bg-surface-field pl-2.5 pr-6 text-right text-sm tabular-nums text-ink focus:outline-hidden focus:ring-2 focus:ring-accent-bright/20',
          invalid ? 'border-negative-line-strong' : 'border-line-field focus:border-accent-bright',
        )}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
        €
      </span>
    </div>
  );
};

export default MoneyInput;
