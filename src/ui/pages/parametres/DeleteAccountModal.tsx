import { useState } from 'react';
import { reauthenticationMethod, type AuthUser, type Reauthentication } from '@/core/auth/model';
import { useAuthAction, useAuthUseCases } from '@/hooks/useAuth';
import Button from '@/ui/design-system/Button';
import { Checkbox, Field, PasswordInput } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Notice from '@/ui/design-system/Notice';
import Text from '@/ui/design-system/Text';

type DeleteAccountModalProps = { user: AuthUser; onClose: () => void };

const DeleteAccountModal = ({ user, onClose }: DeleteAccountModalProps) => {
  const auth = useAuthUseCases();
  const { pending, error, run } = useAuthAction();
  const method = reauthenticationMethod(user);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);

  const reauthentication = (): Reauthentication =>
    method === 'google' ? { method: 'google' } : { method: 'password', password };

  // En cas de succès, la session passe déconnectée et l'écran de connexion remplace l'application.
  const confirm = () => void run(() => auth.deleteAccount(reauthentication()));

  return (
    <Modal
      title="Supprimer mon compte"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!understood}>
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (understood) {
            confirm();
          }
        }}
        noValidate
      >
        <Text>
          Ton identifiant de connexion <strong className="font-semibold">{user.email}</strong> sera supprimé.
          Cette action est définitive.
        </Text>
        <Text variant="muted">
          Les données enregistrées dans ce navigateur ne sont pas effacées. Exporte une sauvegarde complète si
          tu veux les conserver ailleurs.
        </Text>
        {method === 'password' ? (
          <Field label="Mot de passe actuel">
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
        ) : (
          <Notice tone="info">
            Pour confirmer, une fenêtre Google va s’ouvrir : choisis le même compte.
          </Notice>
        )}
        <Checkbox checked={understood} onChange={setUnderstood}>
          Je comprends que la suppression est définitive.
        </Checkbox>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
};

export default DeleteAccountModal;
