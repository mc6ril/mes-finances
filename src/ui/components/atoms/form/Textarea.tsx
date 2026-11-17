import { useLayoutEffect, useRef } from 'react';
import { CONTROL } from '@/ui/design-system/controls';
import { cx } from '@/ui/design-system/cx';

type TextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  autoFocus?: boolean;
};

export const Textarea = ({ value, onChange, placeholder, rows = 2, label, autoFocus }: TextareaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  // La zone grandit avec le texte : tout reste visible, sans barre de défilement.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={rows}
      aria-label={label}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      className={cx(CONTROL, 'h-auto resize-none overflow-hidden py-2')}
    />
  );
};
