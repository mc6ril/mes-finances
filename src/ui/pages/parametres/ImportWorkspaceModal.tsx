import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useFinanceState } from '@/hooks/useFinance';
import type { ImportTarget } from '@/core/store/FinanceStore';
import { formatDateFr } from '@/core/shared/format';
import type { Dataset } from '@/core/shared/model';
import { DEFAULT_WORKSPACE, hasUnsentChanges, isShared, workspaceNameError } from '@/core/espaces/workspaces';
import Button from '@/ui/design-system/Button';
import { Field, Input } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import { errorMessage } from '@/ui/errorMessages';

const NEW_TARGET = 'nouveau';
const DEFAULT_IMPORT_NAME = 'Espace importé';

type ImportWorkspaceModalProps = {
  dataset: Dataset;
  workspaceName: string | null;
  onCancel: () => void;
  onConfirm: (target: ImportTarget) => void;
};

const ImportWorkspaceModal = ({ dataset, workspaceName, onCancel, onConfirm }: ImportWorkspaceModalProps) => {
  const { workspaces } = useFinanceState();
  const targets = workspaces.filter((workspace) => workspace.id !== DEFAULT_WORKSPACE.id);
  const sameName = targets.find(
    (workspace) => workspace.name.toLocaleLowerCase('fr') === (workspaceName ?? '').toLocaleLowerCase('fr'),
  );
  const [choice, setChoice] = useState(sameName?.id ?? NEW_TARGET);
  const [name, setName] = useState(workspaceName ?? DEFAULT_IMPORT_NAME);
  const nameError = choice === NEW_TARGET ? workspaceNameError(name, workspaces) : null;
  const target = targets.find((workspace) => workspace.id === choice);
  const willLoseChanges = target
    ? hasUnsentChanges(target) || (!isShared(target) && Boolean(target.modifiedAt))
    : false;

  const confirm = () => {
    if (choice === NEW_TARGET) {
      onConfirm({ kind: 'new', name });
      return;
    }
    onConfirm({ kind: 'existing', workspaceId: choice });
  };

  return (
    <Modal
      title="Importer un espace"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Annuler</Button>
          <Button variant="primary" onClick={confirm} disabled={nameError !== null}>
            {choice === NEW_TARGET ? 'Créer l’espace' : 'Mettre à jour'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Text variant="small">
          Fichier{workspaceName ? ` « ${workspaceName} »` : ''} : {dataset.accounts.length} compte
          {dataset.accounts.length > 1 ? 's' : ''}, {dataset.transactions.length} opération
          {dataset.transactions.length > 1 ? 's' : ''}. Tes autres espaces ne sont pas touchés.
        </Text>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Destination de l’import</legend>
          {targets.map((workspace) => (
            <label key={workspace.id} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="destination"
                className="mt-0.5"
                checked={choice === workspace.id}
                onChange={() => setChoice(workspace.id)}
              />
              <span>
                Mettre à jour « {workspace.name} »
                {workspace.importedAt && (
                  <Text as="span" variant="small">
                    {' '}
                    · dernier import le {formatDateFr(workspace.importedAt.slice(0, 10))}
                  </Text>
                )}
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="destination"
              className="mt-0.5"
              checked={choice === NEW_TARGET}
              onChange={() => setChoice(NEW_TARGET)}
            />
            Créer un nouvel espace
          </label>
        </fieldset>
        {willLoseChanges && target && (
          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Tu as modifié « {target.name} » depuis le dernier fichier échangé. Ces changements seront
              remplacés par le fichier : exporte d’abord l’espace si tu veux les garder.
            </span>
          </div>
        )}
        {choice === NEW_TARGET && (
          <Field label="Nom de l’espace" error={nameError ? errorMessage({ code: nameError }) : null}>
            <Input value={name} onChange={setName} autoFocus />
          </Field>
        )}
      </div>
    </Modal>
  );
};

export default ImportWorkspaceModal;
