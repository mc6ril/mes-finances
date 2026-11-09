import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { Cents } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Button from '@/ui/design-system/Button';
import { Input } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';

export type EditableLine = { id: string; label: string; amount: Cents };

export const newLineId = (): string =>
  `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type LineEditorProps = {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  defaultLabel: string;
  addLabel: string;
  allowNegative?: boolean;
};

/** Petite liste éditable « libellé + montant » (revenus, entrées ponctuelles). */
const LineEditor = ({ lines, onChange, defaultLabel, addLabel, allowNegative = false }: LineEditorProps) => {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState(defaultLabel);

  const add = (amount: Cents) => {
    if (amount !== 0) {
      onChange([...lines, { id: newLineId(), label: label.trim() || defaultLabel, amount }]);
    }
    setAdding(false);
    setLabel(defaultLabel);
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line) => (
        <li key={line.id} className="group flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-stone-600 dark:text-stone-300">{line.label}</span>
          <span className="flex items-center gap-1">
            <Amount cents={line.amount} className="font-medium text-stone-900 dark:text-stone-50" />
            <Button
              size="sm"
              variant="ghost"
              icon={X}
              label={`Retirer ${line.label}`}
              onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
            />
          </span>
        </li>
      ))}
      {adding ? (
        <li className="flex items-center gap-2">
          <Input value={label} onChange={setLabel} label="Libellé" className="h-9 flex-1" autoFocus />
          <MoneyInput
            cents={0}
            onCommit={add}
            label="Montant"
            className="w-28"
            allowNegative={allowNegative}
          />
        </li>
      ) : (
        <li>
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>
            {addLabel}
          </Button>
        </li>
      )}
    </ul>
  );
};

export default LineEditor;
