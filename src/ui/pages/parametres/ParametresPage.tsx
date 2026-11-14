import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArrowRight,
  ArchiveRestore,
  Banknote,
  Download,
  FileSpreadsheet,
  History,
  PiggyBank,
  Plus,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  useDataset,
  useFileUseCases,
  useFinanceState,
  useFinanceStore,
  useFinanceUseCases,
} from '@/hooks/useFinance';
import { useToast } from '@/hooks/useToast';
import { useReport } from '@/hooks/useReport';
import { useBackupHistory } from '@/hooks/useBackupHistory';
import type { BackupHistory } from '@/core/sauvegarde/interface';
import { GROUP_LABELS, groupLabel } from '@/ui/constants';
import { isSavingsAccount } from '@/core/comptes/accounts';
import Tabs from '@/ui/design-system/Tabs';
import { SETTINGS_TABS, settingsPath, type SettingsTab } from '@/ui/layout/navigation';
import type { WorkspaceData } from '@/core/sauvegarde/fullBackup';
import { mergeSettings, type SettingsMergeSummary } from '@/core/sauvegarde/settingsMerge';
import { parseFlexibleDate, todayIso } from '@/core/shared/dates';
import { formatDateFr } from '@/core/shared/format';
import type {
  Account,
  BudgetPeriod,
  Category,
  CategoryGroup,
  Dataset,
  ThemePreference,
  WorkspaceKind,
} from '@/core/shared/model';
import Badge from '@/ui/design-system/Badge';
import { cx } from '@/ui/design-system/cx';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import MoneyInput from '@/ui/design-system/MoneyInput';
import Segmented from '@/ui/design-system/Segmented';
import Text from '@/ui/design-system/Text';
import PageHeader from '@/ui/layout/PageHeader';
import HouseholdSettings from './HouseholdSettings';
import PreferenceRow from './SettingRow';
import { DEFAULT_HOUSEHOLD } from '@/core/shared/seed';
import { errorMessage } from '@/ui/errorMessages';
import AccountCard from './AccountCard';
import FilePickerButton from './FilePickerButton';
import WorkspacesCard from './WorkspacesCard';
import ImportRulesCard from './ImportRulesCard';

const ProfileCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const { settings } = dataset;
  const changeKind = (kind: WorkspaceKind) =>
    void report(
      finance.updateSettings(
        kind === 'commun' ? { kind, household: settings.household ?? DEFAULT_HOUSEHOLD } : { kind },
        kind === 'commun' ? 'Espace commun' : 'Espace perso',
      ),
    );
  return (
    <Card title="Type d’espace et réglages">
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        <PreferenceRow label="Type d’espace" hint="Un compte commun se partage entre deux personnes.">
          <Segmented<WorkspaceKind>
            value={settings.kind}
            label="Type d’espace"
            onChange={changeKind}
            options={[
              { value: 'perso', label: 'Compte perso' },
              { value: 'commun', label: 'Compte commun' },
            ]}
          />
        </PreferenceRow>
        {settings.kind === 'commun' && settings.household && (
          <HouseholdSettings household={settings.household} />
        )}
        <ThemePicker />
      </div>
    </Card>
  );
};

const ThemePicker = () => {
  const { settings } = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  return (
    <PreferenceRow label="Thème">
      <Segmented<ThemePreference>
        value={settings.theme}
        label="Thème"
        onChange={(theme) => void report(finance.updateSettings({ theme }, null))}
        options={[
          { value: 'system', label: 'Système' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
      />
    </PreferenceRow>
  );
};

type AccountRowProps = { account: Account; isMain: boolean };

const AccountRow = ({ account, isMain }: AccountRowProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [name, setName] = useState(account.name);
  const [openingDate, setOpeningDate] = useState(account.openingDate);
  const save = (patch: Partial<Account>) =>
    void report(finance.saveAccount({ ...account, ...patch }), 'Compte enregistré');
  return (
    <tr className={account.archived ? 'opacity-50' : ''}>
      <td>
        <Input
          value={name}
          onChange={setName}
          onBlur={() => name.trim() && name !== account.name && save({ name: name.trim() })}
          label="Nom du compte"
          className="h-9 min-w-[160px]"
        />
      </td>
      <td>
        <MoneyInput
          key={`${account.id}-${account.openingBalance}`}
          cents={account.openingBalance}
          allowNegative
          label="Solde de départ"
          onCommit={(openingBalance) => save({ openingBalance })}
          className="w-32"
        />
      </td>
      <td>
        <Input
          type="date"
          value={openingDate}
          onChange={setOpeningDate}
          onBlur={() => {
            const parsed = parseFlexibleDate(openingDate);
            if (parsed && parsed !== account.openingDate) {
              save({ openingDate: parsed });
            }
          }}
          label="À la date du"
          className="h-9"
        />
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {isMain && <Badge tone="brand">Principal</Badge>}
          {account.isJoint && <Badge tone="info">Commun</Badge>}
        </div>
      </td>
      <td className="text-right">
        <Button
          variant="ghost"
          size="sm"
          icon={account.archived ? ArchiveRestore : Archive}
          label={account.archived ? 'Réactiver' : 'Archiver'}
          disabled={isMain}
          onClick={() => save({ archived: !account.archived })}
        />
      </td>
    </tr>
  );
};

const AccountsCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const add = () => void report(finance.createAccount('courant'), 'Compte ajouté');
  const currentAccounts = dataset.accounts.filter((account) => !isSavingsAccount(account));
  return (
    <Card
      title="Comptes courants"
      subtitle="Solde de départ à une date donnée : les opérations antérieures à cette date sont considérées comme incluses dans ce solde"
      padded={false}
      action={
        <Button size="sm" icon={Plus} onClick={add}>
          Ajouter un compte
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-base min-w-[620px]">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Solde de départ</th>
              <th>À la date du</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {currentAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                isMain={account.id === dataset.settings.mainAccountId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <Text variant="small">Compte courant principal :</Text>
        <Select
          value={dataset.settings.mainAccountId}
          onChange={(mainAccountId) =>
            void report(finance.updateSettings({ mainAccountId }, 'Compte principal modifié'))
          }
          className="w-56"
          label="Compte principal"
          options={currentAccounts
            .filter((account) => !account.archived)
            .map((account) => ({ value: account.id, label: account.name }))}
        />
      </div>
    </Card>
  );
};

/** Les comptes d'épargne se créent et se modifient dans Épargne et patrimoine, avec leurs mouvements. */
const SavingsAccountsNotice = () => {
  const { accounts } = useDataset();
  const count = accounts.filter((account) => isSavingsAccount(account) && !account.archived).length;
  return (
    <Card title="Comptes d’épargne et placements">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text variant="muted">
          {count === 0
            ? 'Livrets, assurance-vie, bourse, épargne commune : ajoute-les depuis Épargne et patrimoine.'
            : `${count} compte${count > 1 ? 's' : ''} suivi${count > 1 ? 's' : ''}. Livrets, assurance-vie, bourse et épargne commune se créent et se modifient depuis Épargne et patrimoine.`}
        </Text>
        <Link
          to="/patrimoine"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Épargne et patrimoine <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
};

const GROUP_STYLES: Record<CategoryGroup, { icon: LucideIcon; accent: string; dot: string }> = {
  revenu: {
    icon: Banknote,
    accent: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  fixe: {
    icon: Receipt,
    accent: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    dot: 'bg-brand-500',
  },
  epargne: {
    icon: PiggyBank,
    accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  plaisir: {
    icon: ShoppingBag,
    accent: 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300',
    dot: 'bg-pink-500',
  },
};

type CategoryRowProps = { category: Category };

const PERIOD_GROUPS: CategoryGroup[] = ['fixe', 'plaisir'];

const CategoryRow = ({ category }: CategoryRowProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [name, setName] = useState(category.name);
  const hasPeriod = PERIOD_GROUPS.includes(category.group);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(category.name);
      return;
    }
    if (trimmed !== category.name) {
      void report(finance.saveCategory({ ...category, name: trimmed }), 'Catégorie enregistrée');
    }
  };

  return (
    <li
      className={cx(
        'group flex items-center gap-x-3 py-2.5',
        category.archived && '-mx-2 rounded-lg bg-stone-50 px-2 dark:bg-stone-800/40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span
          className={cx(
            'h-2 w-2 shrink-0 rounded-full',
            category.archived ? 'bg-stone-300 dark:bg-stone-600' : GROUP_STYLES[category.group].dot,
          )}
          aria-hidden
        />
        <input
          value={name}
          aria-label={`Nom de la catégorie ${category.name}`}
          disabled={category.archived}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setName(category.name);
              event.currentTarget.blur();
            }
          }}
          className={cx(
            'h-9 min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2.5 text-sm font-medium text-stone-900 transition-colors hover:border-stone-200 focus:border-brand-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 disabled:cursor-default disabled:hover:border-transparent dark:text-stone-100 dark:disabled:hover:border-transparent dark:hover:border-stone-700 dark:focus:bg-stone-900',
            category.archived && 'italic text-stone-500 dark:text-stone-400',
          )}
        />
        {category.archived && <Badge tone="neutral">Archivée</Badge>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasPeriod && !category.archived && (
          <Segmented<BudgetPeriod>
            value={category.period}
            label={`Période de budget ${category.name}`}
            onChange={(period) =>
              void report(finance.saveCategory({ ...category, period }), 'Catégorie enregistrée')
            }
            options={[
              { value: 'mensuel', label: 'Mensuel' },
              { value: 'annuel', label: 'Annuel' },
            ]}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={category.archived ? ArchiveRestore : Archive}
          label={category.archived ? `Réactiver ${category.name}` : `Archiver ${category.name}`}
          className="w-8 px-0"
          onClick={() =>
            void report(
              finance.saveCategory({ ...category, archived: !category.archived }),
              'Catégorie enregistrée',
            )
          }
        />
      </div>
    </li>
  );
};

type CategoryGroupSectionProps = { group: CategoryGroup; categories: Category[] };

const CategoryGroupSection = ({ group, categories }: CategoryGroupSectionProps) => {
  const { settings } = useDataset();
  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);
  const [showArchived, setShowArchived] = useState(false);
  const GroupIcon = GROUP_STYLES[group].icon;
  return (
    <section>
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-2.5 dark:border-stone-800">
        <span
          className={cx('flex h-7 w-7 items-center justify-center rounded-lg', GROUP_STYLES[group].accent)}
        >
          <GroupIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <Text variant="strong">{groupLabel(group, settings.kind)}</Text>
      </div>
      {group === 'epargne' && (
        <Text variant="caption" className="pt-2">
          Une catégorie par compte d’épargne, créée, renommée et archivée avec lui (Épargne et patrimoine).
        </Text>
      )}
      <ul className="divide-y divide-stone-100 dark:divide-stone-800/70">
        {active.map((category) => (
          <CategoryRow key={`${category.id}-${category.name}`} category={category} />
        ))}
        {showArchived &&
          archived.map((category) => (
            <CategoryRow key={`${category.id}-${category.name}`} category={category} />
          ))}
      </ul>
      {archived.length > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="mt-1 text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
        >
          {showArchived ? 'Masquer' : 'Afficher'} {archived.length} catégorie{archived.length > 1 ? 's' : ''}{' '}
          archivée{archived.length > 1 ? 's' : ''}
        </button>
      )}
    </section>
  );
};

const CategoriesCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<CategoryGroup>('plaisir');
  const add = async () => {
    if (!newName.trim()) {
      return;
    }
    if (
      await report(
        finance.saveCategory({
          name: newName.trim(),
          group: newGroup,
          period: 'mensuel',
          archived: false,
        }),
        'Catégorie enregistrée',
      )
    ) {
      setNewName('');
    }
  };
  return (
    <Card
      title="Catégories"
      subtitle="Clique sur un nom pour le modifier. « Annuel » sort la catégorie du budget mensuel pour la suivre sur l’année (voyages, cadeaux…). Une catégorie archivée reste dans l’historique mais n’est plus proposée."
    >
      <div className="mt-2 flex flex-col gap-7">
        {(Object.keys(GROUP_LABELS) as CategoryGroup[]).map((group) => (
          <CategoryGroupSection
            key={group}
            group={group}
            categories={dataset.categories.filter((category) => category.group === group)}
          />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
        <div className="min-w-48 flex-1">
          <Input
            value={newName}
            onChange={setNewName}
            placeholder="Nouvelle catégorie (ex. Sport)"
            label="Nouvelle catégorie"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={newGroup}
            onChange={(value) => setNewGroup(value as CategoryGroup)}
            label="Groupe de la nouvelle catégorie"
            options={(Object.keys(GROUP_LABELS) as CategoryGroup[]).map((value) => ({
              value,
              label: groupLabel(value, dataset.settings.kind),
            }))}
          />
        </div>
        <Button icon={Plus} variant="primary" onClick={() => void add()} disabled={!newName.trim()}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
};

type SettingRowProps = { icon: LucideIcon; title: string; description: string; children: ReactNode };

const SettingRow = ({ icon: Icon, title, description, children }: SettingRowProps) => (
  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-1 last:pb-1">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
    <div className="min-w-48 flex-1">
      <Text variant="strong">{title}</Text>
      <Text variant="small">{description}</Text>
    </div>
    <div className="ml-12 flex items-center gap-2 sm:ml-0">{children}</div>
  </li>
);

type PendingRestore =
  { kind: 'workspace'; dataset: Dataset } | { kind: 'complete'; entries: WorkspaceData[]; activeId: string };

const restoreMessage = (pending: PendingRestore, workspaceName: string): string => {
  if (pending.kind === 'complete') {
    const names = pending.entries.map((entry) => `« ${entry.workspace.name} »`).join(', ');
    return `Tous les espaces actuels seront remplacés par ceux de la sauvegarde : ${names}. Tes espaces absents du fichier seront supprimés ; les espaces communs où tu es invité ne sont pas touchés.`;
  }
  return `Les données de l’espace « ${workspaceName} » seront remplacées par le fichier (${pending.dataset.transactions.length} opérations, ${pending.dataset.accounts.length} comptes). Tes autres espaces ne sont pas touchés.`;
};

const changes = (label: string, { added, updated }: { added: number; updated: number }): string | null =>
  added + updated > 0
    ? `${label} : ${[added && `${added} ajoutée(s)`, updated && `${updated} modifiée(s)`].filter(Boolean).join(', ')}`
    : null;

const settingsMessage = (summary: SettingsMergeSummary): string => {
  const lines = [
    changes('Règles d’import', summary.rules),
    changes('Catégories', summary.categories),
    changes('Comptes', summary.accounts),
    summary.household ? 'Foyer du commun mis à jour' : null,
  ].filter(Boolean);
  return lines.length === 0
    ? 'Ces réglages sont déjà identiques aux tiens.'
    : `${lines.join(' · ')}. Rien n’est supprimé et tes opérations restent en place.`;
};

const lastBackupText = (history: BackupHistory | null): string => {
  if (!history) {
    return 'dernière sauvegarde : inconnue pour l’instant';
  }
  return history.lastFullBackupAt
    ? `dernière le ${formatDateFr(history.lastFullBackupAt.slice(0, 10))}`
    : 'aucune sauvegarde complète pour l’instant';
};

const BackupCard = () => {
  const dataset = useDataset();
  const files = useFileUseCases();
  const { workspace, workspaces } = useFinanceState();
  const finance = useFinanceUseCases();
  const store = useFinanceStore();
  const report = useReport();
  const { notify } = useToast();
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<Dataset | null>(null);

  const onSettingsFile = async (file: File) => {
    const result = await files.readBackupFile(file);
    if (!result.ok) {
      notify(errorMessage(result.error), 'error');
      return;
    }
    const incoming =
      result.value.kind === 'workspace'
        ? result.value.dataset
        : result.value.entries.find((entry) => entry.workspace.id === workspace.id)?.dataset;
    if (!incoming) {
      notify('Aucun espace de ce nom dans la sauvegarde complète : choisis le fichier d’un espace.', 'error');
      return;
    }
    setPendingSettings(incoming);
  };

  const { history, exportAll } = useBackupHistory();

  const exportOperations = () => {
    const saved = files.exportOperationsCsv({
      fileLabel: workspace.name,
      period: todayIso(),
      transactions: dataset.transactions,
      categories: dataset.categories,
      accounts: dataset.accounts,
    });
    if (!saved.ok) {
      notify(errorMessage(saved.error), 'error');
    }
  };

  const onFile = async (file: File) => {
    const result = await files.readBackupFile(file);
    if (!result.ok) {
      notify(errorMessage(result.error), 'error');
      return;
    }
    if (result.value.kind === 'complete') {
      setPending({ kind: 'complete', entries: result.value.entries, activeId: result.value.activeId });
      return;
    }
    setPending({ kind: 'workspace', dataset: result.value.dataset });
  };

  const confirmRestore = (restore: PendingRestore) => {
    if (restore.kind === 'complete') {
      void report(store.restoreAll(restore.entries, restore.activeId), 'Sauvegarde complète restaurée');
      return;
    }
    void report(finance.restore(restore.dataset), 'Sauvegarde restaurée');
  };

  return (
    <Card
      title="Sauvegardes"
      subtitle="Tes données sont enregistrées en ligne et synchronisées entre tes appareils. La base gratuite n’a pas de sauvegarde automatique : exporte régulièrement une sauvegarde complète."
    >
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        <SettingRow
          icon={Archive}
          title="Sauvegarde complète"
          description={`Tous tes espaces : ${workspaces.map((item) => item.name).join(', ')} · ${lastBackupText(history)}`}
        >
          <Button
            size="sm"
            variant="primary"
            icon={Download}
            label="Tout sauvegarder"
            className="w-8 px-0"
            onClick={() => void exportAll()}
          />
        </SettingRow>
        <SettingRow
          icon={ArchiveRestore}
          title="Restaurer"
          description="Sauvegarde complète : remplace tous les espaces. Fichier d’un espace : remplace l’espace affiché."
        >
          <FilePickerButton
            label="Choisir un fichier à restaurer"
            onFile={(file) => void onFile(file)}
            iconOnly
          />
        </SettingRow>
        <SettingRow
          icon={SlidersHorizontal}
          title="Importer des réglages"
          description="Règles d’import, catégories, comptes et soldes de départ, foyer du commun. Les opérations, budgets et notes sont conservés."
        >
          <FilePickerButton
            label="Choisir un fichier de réglages"
            onFile={(file) => void onSettingsFile(file)}
            iconOnly
          />
        </SettingRow>
        <SettingRow
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
        </SettingRow>
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        <Text variant="caption" className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          Données visibles par toi seul (et la personne invitée pour un commun) · aucune connexion bancaire
        </Text>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
          Réinitialiser « {workspace.name} »
        </Button>
      </div>
      {pending && (
        <ConfirmDialog
          title={
            pending.kind === 'complete' ? 'Restaurer la sauvegarde complète ?' : 'Restaurer cet espace ?'
          }
          message={`${restoreMessage(pending, workspace.name)} Exporte d’abord une sauvegarde de l’état actuel si tu veux pouvoir revenir en arrière.`}
          confirmLabel="Restaurer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            confirmRestore(pending);
            setPending(null);
          }}
        />
      )}
      {pendingSettings && (
        <ConfirmDialog
          title={`Importer les réglages dans « ${workspace.name} » ?`}
          message={settingsMessage(mergeSettings(dataset, pendingSettings).summary)}
          confirmLabel="Importer"
          onCancel={() => setPendingSettings(null)}
          onConfirm={() => {
            void report(finance.importSettings(pendingSettings), 'Réglages importés');
            setPendingSettings(null);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title={`Réinitialiser l’espace « ${workspace.name} » ?`}
          message="Toutes les opérations, budgets et objectifs de cet espace seront effacés et la configuration initiale rétablie. Tes autres espaces ne sont pas touchés. Cette action est irréversible sans sauvegarde."
          confirmLabel="Réinitialiser"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            void report(finance.resetWorkspace(), 'Espace réinitialisé');
            setConfirmReset(false);
          }}
        />
      )}
    </Card>
  );
};

const AuditCard = () => {
  const dataset = useDataset();
  const entries = [...dataset.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  return (
    <Card title="Historique des modifications" subtitle="Les 40 dernières actions">
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2">
            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
            <Text variant="small">
              <span className="tabular-nums">{formatDateFr(entry.at.slice(0, 10))}</span> ·{' '}
              <span className="font-medium text-stone-700 dark:text-stone-200">{entry.entity}</span> ·{' '}
              {entry.summary}
            </Text>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const TAB_CONTENT: Record<SettingsTab, () => ReactNode> = {
  espace: () => (
    <>
      <WorkspacesCard />
      <ProfileCard />
    </>
  ),
  comptes: () => (
    <>
      <AccountsCard />
      <SavingsAccountsNotice />
    </>
  ),
  categories: () => (
    <>
      <CategoriesCard />
      <ImportRulesCard />
    </>
  ),
  sauvegardes: () => (
    <>
      <BackupCard />
      <AuditCard />
    </>
  ),
  compte: () => <AccountCard />,
};

const isSettingsTab = (value: string | undefined): value is SettingsTab =>
  SETTINGS_TABS.some((tab) => tab.id === value);

const ParametresPage = () => {
  const { tab } = useParams();
  if (tab !== undefined && !isSettingsTab(tab)) {
    return <Navigate to={settingsPath('espace')} replace />;
  }
  const active: SettingsTab = tab ?? 'espace';
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Paramètres" />
      <Tabs
        label="Sections des paramètres"
        active={active}
        tabs={SETTINGS_TABS.map((item) => ({ ...item, to: settingsPath(item.id) }))}
      />
      {TAB_CONTENT[active]()}
    </div>
  );
};

export default ParametresPage;
