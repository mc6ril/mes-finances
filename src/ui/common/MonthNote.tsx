import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import { cx } from '@/ui/design-system/cx';
import { Textarea } from '@/ui/design-system/Field';

const useSavedNote = (month: MonthKey): string =>
  useDataset().monthNotes.find((note) => note.month === month)?.text ?? '';

type NoteButtonProps = { month: MonthKey; onClick: () => void };

/** Icône discrète de l'en-tête : ambrée avec une pastille quand le mois a une note. */
export const MonthNoteButton = ({ month, onClick }: NoteButtonProps) => {
  const hasNote = useSavedNote(month) !== '';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        hasNote ? `Modifier la note de ${monthLabel(month)}` : `Ajouter une note pour ${monthLabel(month)}`
      }
      title={hasNote ? 'Note du mois' : 'Ajouter une note pour ce mois'}
      className={cx(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
        hasNote
          ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10'
          : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200',
      )}
    >
      <StickyNote className="h-[18px] w-[18px]" aria-hidden />
      {hasNote && (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      )}
    </button>
  );
};

type MonthNoteProps = { month: MonthKey; editing: boolean; onEditingChange: (editing: boolean) => void };

/** Note du mois : rien quand elle est vide, une ligne discrète sinon, un éditeur à la demande. */
const MonthNote = ({ month, editing, onEditingChange }: MonthNoteProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const saved = useSavedNote(month);
  const [draft, setDraft] = useState(saved);

  const open = () => {
    setDraft(saved);
    onEditingChange(true);
  };

  const save = async () => {
    const message = draft.trim() ? 'Note enregistrée' : saved ? 'Note supprimée' : null;
    if (await report(finance.setMonthNote(month, draft), message)) {
      onEditingChange(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
        <Textarea
          value={draft}
          onChange={setDraft}
          rows={3}
          autoFocus
          label={`Note de ${monthLabel(month)}`}
          placeholder="Prime exceptionnelle, assurance payée en avance, remboursement attendu…"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" onClick={() => onEditingChange(false)}>
            Annuler
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()}>
            Enregistrer
          </Button>
        </div>
      </div>
    );
  }

  if (!saved) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Modifier la note"
      className="group -mt-2 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-stone-600 transition-colors hover:bg-amber-50 dark:text-stone-300 dark:hover:bg-amber-500/5"
    >
      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
      <span className="line-clamp-2 whitespace-pre-wrap">{saved}</span>
    </button>
  );
};

export default MonthNote;
