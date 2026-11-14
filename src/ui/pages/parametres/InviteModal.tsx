import { Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { Workspace } from '@/core/espaces/workspaces';
import { INVITATION_VALIDITY_DAYS } from '@/core/partage/model';
import { useReport } from '@/hooks/useReport';
import { invitationLink, useWorkspaceInvitation } from '@/hooks/useSharing';
import { useToast } from '@/hooks/useToast';
import Button from '@/ui/design-system/Button';
import { Modal } from '@/ui/design-system/Modal';
import Notice from '@/ui/design-system/Notice';
import Text from '@/ui/design-system/Text';
import { errorMessage } from '@/ui/errorMessages';

type InviteModalProps = { workspace: Workspace; onClose: () => void };

/** Lien d'invitation à envoyer : usage unique, valable 7 jours, annulable. */
const InviteModal = ({ workspace, onClose }: InviteModalProps) => {
  const { invitation, pending, error, cancel } = useWorkspaceInvitation(workspace);
  const report = useReport();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const link = invitation ? invitationLink(invitation.token) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      notify('Copie impossible : sélectionne le lien et copie-le à la main.', 'error');
    }
  };

  const revokeLink = async () => {
    if (await report(cancel(), 'Invitation annulée')) {
      onClose();
    }
  };

  return (
    <Modal
      title={`Inviter dans « ${workspace.name} »`}
      onClose={onClose}
      footer={
        <>
          {invitation && (
            <Button variant="ghost" onClick={() => void revokeLink()}>
              Annuler l’invitation
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Text variant="muted">
          Envoie ce lien à la personne de ton choix. Elle se connecte (ou crée son compte), puis rejoint
          l’espace : vous pourrez tous les deux le consulter et le modifier. Tes espaces perso restent privés.
        </Text>
        {pending && <Text variant="muted">Préparation du lien…</Text>}
        {error && <Notice tone="error">{errorMessage(error)}</Notice>}
        {invitation && (
          <>
            <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              <code className="min-w-0 flex-1 break-all text-xs text-stone-700 dark:text-stone-300">
                {link}
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={Copy} onClick={() => void copy()}>
                {copied ? 'Lien copié' : 'Copier le lien'}
              </Button>
              <Text variant="small">
                À usage unique, valable {INVITATION_VALIDITY_DAYS} jours (jusqu’au{' '}
                {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')}).
              </Text>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default InviteModal;
