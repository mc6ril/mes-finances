import { Check, LogOut, Pencil, Plus, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import type { WorkspaceKind } from '@/core/shared/model';
import { canDelete, canInvite, type Workspace } from '@/core/espaces/workspaces';
import { useSharingUseCases } from '@/hooks/useSharing';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import InviteModal from './InviteModal';

type SharingAction = { kind: 'invite' | 'revoke' | 'leave'; workspace: Workspace };

type WorkspaceRowProps = {
  workspace: Workspace;
  isActive: boolean;
  onDelete: (workspace: Workspace) => void;
  onSharing: (action: SharingAction) => void;
};

const sharingLabel = (workspace: Workspace): string => {
  if (workspace.role === 'guest') {
    return 'Commun · invité';
  }
  return workspace.shared ? 'Commun · partagé' : 'Commun';
};

const WorkspaceRow = ({ workspace, isActive, onDelete, onSharing }: WorkspaceRowProps) => {
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
            {workspace.kind === 'commun' && (
              <Badge tone="neutral">
                <Users className="mr-1 inline h-3 w-3" aria-hidden />
                {sharingLabel(workspace)}
              </Badge>
            )}
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
        {draft === null && canInvite(workspace) && !workspace.shared && (
          <Button
            size="sm"
            variant="ghost"
            icon={UserPlus}
            label={`Inviter dans ${workspace.name}`}
            onClick={() => onSharing({ kind: 'invite', workspace })}
          />
        )}
        {draft === null && canInvite(workspace) && workspace.shared && (
          <Button
            size="sm"
            variant="ghost"
            icon={UserMinus}
            label={`Retirer l’accès à ${workspace.name}`}
            onClick={() => onSharing({ kind: 'revoke', workspace })}
          />
        )}
        {draft === null && workspace.role === 'guest' && (
          <Button
            size="sm"
            variant="ghost"
            icon={LogOut}
            label={`Quitter ${workspace.name}`}
            onClick={() => onSharing({ kind: 'leave', workspace })}
          />
        )}
        {canDelete(workspace) && (
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
  const { workspaces, workspace: active } = useFinanceState();
  const store = useFinanceStore();
  const report = useReport();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<WorkspaceKind>('perso');
  const [toDelete, setToDelete] = useState<Workspace | null>(null);
  const [sharingAction, setSharingAction] = useState<SharingAction | null>(null);
  const sharing = useSharingUseCases();

  const create = async () => {
    if (await report(store.createWorkspace(newName, newKind), 'Espace créé')) {
      setNewName('');
      setNewKind('perso');
    }
  };

  return (
    <Card
      title="Espaces de suivi"
      subtitle="Chaque espace est indépendant : comptes, catégories, budgets et réglages propres. Un espace commun peut être partagé avec une seule personne, sur invitation."
    >
      <ul className="flex flex-col gap-2">
        {workspaces.map((workspace) => (
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            isActive={workspace.id === active.id}
            onDelete={setToDelete}
            onSharing={setSharingAction}
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
        <div className="w-full sm:w-44">
          <Select
            value={newKind}
            onChange={(kind) => setNewKind(kind as WorkspaceKind)}
            label="Type du nouvel espace"
            options={[
              { value: 'perso', label: 'Compte perso' },
              { value: 'commun', label: 'Compte commun' },
            ]}
          />
        </div>
        <Button icon={Plus} onClick={() => void create()} disabled={!newName.trim()}>
          Créer
        </Button>
      </div>
      {sharingAction?.kind === 'invite' && (
        <InviteModal workspace={sharingAction.workspace} onClose={() => setSharingAction(null)} />
      )}
      {sharingAction?.kind === 'revoke' && (
        <ConfirmDialog
          title={`Retirer l’accès à « ${sharingAction.workspace.name} » ?`}
          message="La personne invitée ne verra plus cet espace. Ses données restent dans l’espace, qui reste le tien. Tu pourras l’inviter de nouveau avec un nouveau lien."
          confirmLabel="Retirer l’accès"
          onCancel={() => setSharingAction(null)}
          onConfirm={() => {
            void report(sharing.revoke(sharingAction.workspace), 'Accès retiré');
            setSharingAction(null);
          }}
        />
      )}
      {sharingAction?.kind === 'leave' && (
        <ConfirmDialog
          title={`Quitter « ${sharingAction.workspace.name} » ?`}
          message="Tu ne verras plus cet espace commun ; il reste à son propriétaire. Pour y revenir, il faudra une nouvelle invitation."
          confirmLabel="Quitter"
          onCancel={() => setSharingAction(null)}
          onConfirm={() => {
            void report(sharing.leave(sharingAction.workspace), 'Espace quitté');
            setSharingAction(null);
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Supprimer l’espace « ${toDelete.name} » ?`}
          message="Toutes ses données (comptes, opérations, budgets…) seront effacées, pour toi comme pour la personne invitée. Tes autres espaces ne sont pas touchés. Exporte d’abord une sauvegarde si tu veux pouvoir le retrouver."
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
