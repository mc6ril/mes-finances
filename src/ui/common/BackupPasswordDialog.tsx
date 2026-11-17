import { useState, type FormEvent } from 'react';
import { MIN_BACKUP_PASSWORD_LENGTH } from '@/core/sauvegarde/encryptedBackup';
import Button from '@/ui/components/atoms/Button';
import { Field } from '@/ui/components/molecules/form/Field';
import { PasswordInput } from '@/ui/components/atoms/form/PasswordInput';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Text from '@/ui/components/atoms/Text';

type BackupPasswordDialogProps = {
  /** `create` : choisir le mot de passe d'un export ; `unlock` : ouvrir une sauvegarde protégée. */
  mode: 'create' | 'unlock';
  /** Renvoie un message d'erreur à afficher, ou null si c'est fait (la fenêtre se ferme alors). */
  onSubmit: (password: string) => Promise<string | null>;
  onCancel: () => void;
};

const BackupPasswordDialog = ({ mode, onSubmit, onCancel }: BackupPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const creating = mode === 'create';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (creating && password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setError(`Au moins ${MIN_BACKUP_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (creating && password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPending(true);
    const failure = await onSubmit(password);
    setPending(false);
    setError(failure);
  };

  return (
    <Modal title={creating ? 'Protéger la sauvegarde' : 'Sauvegarde protégée'} onClose={onCancel}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <Text variant="small">
          {creating
            ? 'Le fichier est chiffré avec ce mot de passe, sur ton appareil. Sans lui, personne ne peut le lire ni le restaurer — toi non plus : s’il est perdu, la sauvegarde est perdue.'
            : 'Saisis le mot de passe choisi lors de l’export de cette sauvegarde.'}
        </Text>
        <Field label="Mot de passe" error={creating ? null : error}>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete={creating ? 'new-password' : 'current-password'}
            autoFocus
          />
        </Field>
        {creating && (
          <Field label="Confirmation" error={error} hint={`${MIN_BACKUP_PASSWORD_LENGTH} caractères minimum`}>
            <PasswordInput value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          </Field>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>Annuler</Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!password}>
            {creating ? 'Exporter' : 'Ouvrir'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default BackupPasswordDialog;
