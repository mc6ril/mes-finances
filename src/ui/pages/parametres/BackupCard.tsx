import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArchiveRestore,
  Download,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useBackupHistory } from '@/hooks/useBackupHistory';
import BackupPasswordDialog from '@/ui/common/BackupPasswordDialog';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import { ConfirmDialog } from '@/ui/components/molecules/overlays/ConfirmDialog';
import Text from '@/ui/components/atoms/Text';
import { lastBackupText } from './backupMessages';
import FilePickerButton from '@/ui/components/molecules/form/FilePickerButton';
import { useBackupActions } from './useBackupActions';

type BackupRowProps = { icon: LucideIcon; title: string; description: string; children: ReactNode };

/** Ligne d'action de la carte Sauvegardes : icône, intitulé et description, bouton à droite. */
const BackupRow = ({ icon: Icon, title, description, children }: BackupRowProps) => (
  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-1 last:pb-1">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-subtle">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
    <div className="min-w-48 flex-1">
      <Text variant="strong">{title}</Text>
      <Text variant="small">{description}</Text>
    </div>
    <div className="ml-12 flex items-center gap-2 sm:ml-0">{children}</div>
  </li>
);

const BackupCard = () => {
  const { history, exportAll } = useBackupHistory();
  const {
    workspace,
    workspaces,
    dialogs,
    restoreText,
    settingsText,
    openFile,
    pickFile,
    exportOperations,
    close,
    requestReset,
    confirmRestore,
    confirmSettings,
    confirmReset,
  } = useBackupActions();
  const { restore, locked, settings, reset } = dialogs;

  return (
    <Card
      title="Sauvegardes"
      subtitle="Tes données sont enregistrées en ligne et synchronisées entre tes appareils. La base gratuite n’a pas de sauvegarde automatique : exporte régulièrement une sauvegarde complète."
    >
      <ul className="divide-y divide-line">
        <BackupRow
          icon={Archive}
          title="Sauvegarde complète"
          description={`Tous tes espaces, chiffrés par un mot de passe : ${workspaces.map((item) => item.name).join(', ')} · ${lastBackupText(history)}`}
        >
          <Button
            size="sm"
            variant="primary"
            icon={Download}
            label="Tout sauvegarder"
            className="w-8 px-0"
            onClick={() => void exportAll()}
          />
        </BackupRow>
        <BackupRow
          icon={ArchiveRestore}
          title="Restaurer"
          description="Sauvegarde complète : remplace les espaces du fichier, chez toi ; les autres ne sont pas touchés."
        >
          <FilePickerButton
            label="Choisir un fichier à restaurer"
            onFile={(file) => void pickFile('restore')(file)}
            iconOnly
          />
        </BackupRow>
        <BackupRow
          icon={SlidersHorizontal}
          title="Importer des réglages"
          description="Règles d’import, catégories, comptes et soldes de départ, foyer du commun. Les opérations, budgets et notes sont conservés."
        >
          <FilePickerButton
            label="Choisir un fichier de réglages"
            onFile={(file) => void pickFile('settings')(file)}
            iconOnly
          />
        </BackupRow>
        <BackupRow
          icon={FileSpreadsheet}
          title="Opérations en CSV"
          description={`Espace « ${workspace.name} », lisible dans un tableur`}
        >
          <Button
            size="sm"
            icon={Download}
            label="Exporter en CSV"
            className="w-8 px-0"
            onClick={exportOperations}
          />
        </BackupRow>
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <Text variant="caption" className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-positive-fixed" aria-hidden />
          Données visibles par toi seul (et la personne invitée pour un commun) · aucune connexion bancaire
        </Text>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={requestReset}>
          Réinitialiser « {workspace.name} »
        </Button>
      </div>
      {restore && (
        <ConfirmDialog
          title="Restaurer la sauvegarde complète ?"
          message={`${restoreText} Exporte d’abord une sauvegarde de l’état actuel si tu veux pouvoir revenir en arrière.`}
          confirmLabel="Restaurer"
          onCancel={() => close('restore')}
          onConfirm={() => confirmRestore(restore)}
        />
      )}
      {locked && (
        <BackupPasswordDialog
          mode="unlock"
          onSubmit={(password) => openFile(locked.file, locked.purpose, password)}
          onCancel={() => close('locked')}
        />
      )}
      {settings && (
        <ConfirmDialog
          title={`Importer les réglages dans « ${workspace.name} » ?`}
          message={settingsText ?? ''}
          confirmLabel="Importer"
          onCancel={() => close('settings')}
          onConfirm={() => confirmSettings(settings)}
        />
      )}
      {reset && (
        <ConfirmDialog
          title={`Réinitialiser l’espace « ${workspace.name} » ?`}
          message="Toutes les opérations, budgets et objectifs de cet espace seront effacés et la configuration initiale rétablie. Tes autres espaces ne sont pas touchés. Cette action est irréversible sans sauvegarde."
          confirmLabel="Réinitialiser"
          onCancel={() => close('reset')}
          onConfirm={confirmReset}
        />
      )}
    </Card>
  );
};

export default BackupCard;
