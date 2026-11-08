import { Goal as GoalIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Goal } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import EmptyState from '@/ui/design-system/EmptyState';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import PageHeader from '@/ui/layout/PageHeader';
import GoalCard from './GoalCard';
import GoalModal from './GoalModal';

const ObjectifsPage = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [editing, setEditing] = useState<Goal | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Objectifs financiers"
        description="Projections calculées à partir de tes versements prévus"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            Nouvel objectif
          </Button>
        }
      />
      {dataset.goals.length === 0 ? (
        <EmptyState
          icon={GoalIcon}
          title="Aucun objectif pour le moment"
          description="Exemples : atteindre 15 000 € d’épargne personnelle, constituer un apport immobilier, financer un voyage."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Créer un objectif
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {dataset.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onDelete={() => setToDelete(goal)}
            />
          ))}
        </div>
      )}
      {editing && <GoalModal goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Supprimer l’objectif ?"
          message={`« ${toDelete.name} » sera supprimé. Tes comptes et opérations ne sont pas modifiés.`}
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void report(finance.deleteGoal(toDelete), 'Objectif supprimé');
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default ObjectifsPage;
