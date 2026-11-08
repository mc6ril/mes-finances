import { useState } from 'react';
import { useFinanceState } from '@/app/FinanceContext';
import type { ImportTarget } from '@/app/FinanceStore';
import { formatDateFr } from '@/core/format';
import type { Dataset } from '@/core/model';
import { isReadOnly, workspaceNameError } from '@/core/workspaces';
import Button from '@/ui/design-system/Button';
import { Field, Input } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';

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
  const imported = workspaces.filter(isReadOnly);
  const sameName = imported.find(
    (workspace) => workspace.name.toLocaleLowerCase('fr') === (workspaceName ?? '').toLocaleLowerCase('fr'),
  );
  const [choice, setChoice] = useState(sameName?.id ?? NEW_TARGET);
  const [name, setName] = useState(workspaceName ?? DEFAULT_IMPORT_NAME);
  const nameError = choice === NEW_TARGET ? workspaceNameError(name, workspaces) : null;

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
          {dataset.transactions.length > 1 ? 's' : ''}. L’espace importé est en lecture seule et n’a aucun
          effet sur tes autres espaces.
        </Text>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Destination de l’import</legend>
          {imported.map((workspace) => (
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
        {choice === NEW_TARGET && (
          <Field label="Nom de l’espace" error={nameError}>
            <Input value={name} onChange={setName} autoFocus />
          </Field>
        )}
      </div>
    </Modal>
  );
};

export default ImportWorkspaceModal;
