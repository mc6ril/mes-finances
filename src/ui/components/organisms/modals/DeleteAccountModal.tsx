import { useState } from 'react';
import { type AuthUser, type Reauthentication, reauthenticationMethod } from '@/core/auth/model';
import { useAuthAction, useAuthUseCases } from '@/hooks/useAuth';
import Button from '@/ui/components/atoms/Button';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { PasswordInput } from '@/ui/components/atoms/form/PasswordInput';
import Text from '@/ui/components/atoms/Text';
import Notice from '@/ui/components/molecules/feedback/Notice';
import { Field } from '@/ui/components/molecules/form/Field';
import { Modal } from '@/ui/components/molecules/overlays/Modal';

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
          Tes espaces et leurs données sont supprimés. Un espace commun partagé est transmis à la personne
          invitée, qui le garde ; tu quittes les espaces communs où tu es invité. Exporte d’abord une
          sauvegarde complète si tu veux conserver tes données.
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
