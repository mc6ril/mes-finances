import { Pencil, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import { Textarea } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';

type MonthNoteProps = { month: MonthKey };

/** Note libre du mois, partagée entre Budget et Compte courant. */
const MonthNote = ({ month }: MonthNoteProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const saved = dataset.monthNotes.find((note) => note.month === month)?.text ?? '';
  const [draft, setDraft] = useState<string | null>(null);

  const save = async () => {
    if (draft === null) {
      return;
    }
    const message = draft.trim() ? 'Note enregistrée' : saved ? 'Note supprimée' : null;
    if (await report(finance.setMonthNote(month, draft), message)) {
      setDraft(null);
    }
  };

  if (draft !== null) {
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
          <Button size="sm" onClick={() => setDraft(null)}>
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
    return (
      <div>
        <Button size="sm" variant="ghost" icon={StickyNote} onClick={() => setDraft('')}>
          Ajouter une note pour {monthLabel(month)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
      <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <Text variant="label">Note de {monthLabel(month)}</Text>
        <Text className="mt-0.5 whitespace-pre-wrap">{saved}</Text>
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={Pencil}
        label="Modifier la note"
        onClick={() => setDraft(saved)}
      />
    </div>
  );
};

export default MonthNote;
