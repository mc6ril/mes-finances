import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useFileUseCases, useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { useToast } from '@/hooks/useToast';
import { useReport } from '@/hooks/useReport';
import { formatDateFr } from '@/core/format';
import type { Dataset } from '@/core/model';
import { DEFAULT_WORKSPACE, hasUnsentChanges, isShared, type Workspace } from '@/core/workspaces';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Input } from '@/ui/design-system/Field';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import { errorMessage } from '@/ui/errorMessages';
import FilePickerButton from './FilePickerButton';
import ImportWorkspaceModal from './ImportWorkspaceModal';

type PendingImport = { dataset: Dataset; workspaceName: string | null };

type WorkspaceRowProps = {
  workspace: Workspace;
  isActive: boolean;
  onDelete: (workspace: Workspace) => void;
};

const dayOf = (date: string): string => formatDateFr(date.slice(0, 10));

const SharingDates = ({ workspace }: { workspace: Workspace }) => {
  const parts = [
    workspace.importedAt ? `reçu le ${dayOf(workspace.importedAt)}` : null,
    workspace.sharedAt ? `envoyé le ${dayOf(workspace.sharedAt)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return <Text variant="small">{`Dernier fichier ${parts.join(' · ')}`}</Text>;
};

const WorkspaceRow = ({ workspace, isActive, onDelete }: WorkspaceRowProps) => {
  const store = useFinanceStore();
  const report = useReport();
  const [draft, setDraft] = useState<string | null>(null);

  const saveName = async () => {
    if (draft === null) {
      return;
    }
    if (
      draft.trim() === workspace.name ||
      (await report(store.renameWorkspace(workspace.id, draft), 'Espace renommé'))
    ) {
      setDraft(null);
    }
  };

  const onKey = (key: string) => {
    if (key === 'Enter') {
      void saveName();
    }
    if (key === 'Escape') {
      setDraft(null);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-100 px-4 py-3 dark:border-stone-800">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {draft === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Text variant="strong">{workspace.name}</Text>
            {isActive && <Badge tone="info">Affiché</Badge>}
            {isShared(workspace) && (
              <Badge tone="neutral">
                <Users className="mr-1 inline h-3 w-3" aria-hidden />
                Partagé
              </Badge>
            )}
            {hasUnsentChanges(workspace) && <Badge tone="warning">Modifications non envoyées</Badge>}
          </div>
        ) : (
          <Input
            value={draft}
            onChange={setDraft}
            onBlur={() => void saveName()}
            onKeyDown={onKey}
            label="Nom de l’espace"
            autoFocus
            className="h-9 max-w-xs"
          />
        )}
        <SharingDates workspace={workspace} />
      </div>
      <div className="flex items-center gap-1">
        {!isActive && draft === null && (
          <Button size="sm" onClick={() => void report(store.switchWorkspace(workspace.id))}>
            Ouvrir
          </Button>
        )}
        {draft === null ? (
          <Button
            size="sm"
            variant="ghost"
            icon={Pencil}
            label={`Renommer ${workspace.name}`}
            onClick={() => setDraft(workspace.name)}
          />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={Check}
            label="Enregistrer le nom"
            onClick={() => void saveName()}
          />
        )}
        {workspace.id !== DEFAULT_WORKSPACE.id && (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            label={`Supprimer ${workspace.name}`}
            onClick={() => onDelete(workspace)}
          />
        )}
      </div>
    </li>
  );
};

const WorkspacesCard = () => {
  const files = useFileUseCases();
  const { workspaces, workspace: active } = useFinanceState();
  const store = useFinanceStore();
  const report = useReport();
  const { notify } = useToast();
  const [newName, setNewName] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [toDelete, setToDelete] = useState<Workspace | null>(null);

  const create = async () => {
    if (await report(store.createWorkspace(newName), 'Espace créé')) {
      setNewName('');
    }
  };

  const onFile = async (file: File) => {
    const result = await files.readBackupFile(file);
    if (!result.ok) {
      notify(errorMessage(result.error), 'error');
      return;
    }
    if (result.value.kind === 'complete') {
      notify(
        'Ce fichier est une sauvegarde complète de tous les espaces : utilise « Restaurer » dans Sauvegardes.',
        'error',
      );
      return;
    }
    setPendingImport({ dataset: result.value.dataset, workspaceName: result.value.workspaceName });
  };

  return (
    <Card
      title="Espaces de suivi"
      subtitle="Chaque espace est indépendant : comptes, catégories, budgets et réglages propres. Un espace partagé (par exemple le compte commun) passe de l’un à l’autre : celui qui fait les comptes l’exporte et l’envoie, l’autre l’importe."
    >
      <ul className="flex flex-col gap-2">
        {workspaces.map((workspace) => (
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            isActive={workspace.id === active.id}
            onDelete={setToDelete}
          />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <Input
            value={newName}
            onChange={setNewName}
            placeholder="Nom du nouvel espace (ex. Commun)"
            label="Nom du nouvel espace"
          />
        </div>
        <Button icon={Plus} onClick={() => void create()} disabled={!newName.trim()}>
          Créer
        </Button>
        <FilePickerButton label="Importer un espace" onFile={(file) => void onFile(file)} />
      </div>
      {pendingImport && (
        <ImportWorkspaceModal
          dataset={pendingImport.dataset}
          workspaceName={pendingImport.workspaceName}
          onCancel={() => setPendingImport(null)}
          onConfirm={(target) => {
            void report(
              store.importWorkspace(pendingImport.dataset, target),
              target.kind === 'new' ? 'Espace importé' : 'Espace mis à jour',
            );
            setPendingImport(null);
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Supprimer l’espace « ${toDelete.name} » ?`}
          message="Toutes ses données (comptes, opérations, budgets…) seront effacées de ce navigateur. Tes autres espaces ne sont pas touchés. Exporte d’abord une sauvegarde si tu veux pouvoir le retrouver."
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void report(store.deleteWorkspace(toDelete.id), 'Espace supprimé');
            setToDelete(null);
          }}
        />
      )}
    </Card>
  );
};

export default WorkspacesCard;
