import { LogOut, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { userLabel } from '@/core/auth/model';
import { useAuthUseCases, useCurrentUser } from '@/hooks/useAuth';
import { useReport } from '@/hooks/useReport';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import SettingRow from '@/ui/components/molecules/form/PreferenceRow';
import DeleteAccountModal from '@/ui/components/organisms/modals/DeleteAccountModal';

const PROVIDER_LABELS = { password: 'E-mail et mot de passe', google: 'Google' } as const;

const AccountCard = () => {
  const user = useCurrentUser();
  const auth = useAuthUseCases();
  const report = useReport();
  const [deleting, setDeleting] = useState(false);
  const methods = user.providers.map((provider) => PROVIDER_LABELS[provider]).join(' · ');

  return (
    <Card title="Mon compte">
      <div className="divide-y divide-line">
        <SettingRow label={userLabel(user)} hint={user.email ?? undefined}>
          {methods && <Badge>{methods}</Badge>}
        </SettingRow>
        <SettingRow label="Déconnexion" hint="Tu devras te reconnecter pour accéder à tes comptes.">
          <Button icon={LogOut} onClick={() => void report(auth.signOut())}>
            Se déconnecter
          </Button>
        </SettingRow>
        <SettingRow
          label="Supprimer mon compte"
          hint="Supprime définitivement ton compte et tes espaces ; un espace commun partagé reste à la personne invitée."
        >
          <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>
            Supprimer…
          </Button>
        </SettingRow>
      </div>
      {deleting && <DeleteAccountModal user={user} onClose={() => setDeleting(false)} />}
    </Card>
  );
};

export default AccountCard;
