import {
  Archive,
  ArchiveRestore,
  Download,
  FlaskConical,
  History,
  Plus,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { newId, useDataset, useFinanceState, useToast } from '@/app/FinanceContext';
import { useFinanceActions } from '@/app/useFinanceActions';
import { downloadTextFile, parseJsonText, readFileText } from '@/adapters/files/files';
import { ACCOUNT_KIND_LABELS, GROUP_LABELS } from '@/constants/misc';
import { createBackup, readBackup } from '@/core/backup';
import { transactionsToCsv } from '@/core/csvImport';
import { parseFlexibleDate, todayIso } from '@/core/dates';
import { formatDateFr } from '@/core/format';
import type {
  Account,
  AccountGroup,
  AccountKind,
  BudgetPeriod,
  Category,
  CategoryGroup,
  Dataset,
  ThemePreference,
  TrackingMode,
} from '@/core/model';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Field, Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog } from '@/ui/design-system/Modal';
import MoneyInput from '@/ui/design-system/MoneyInput';
import Segmented from '@/ui/design-system/Segmented';
import Text from '@/ui/design-system/Text';
import PageHeader from '@/ui/layout/PageHeader';

const GROUP_BY_KIND: Record<AccountKind, AccountGroup> = {
  courant: 'courant',
  livret: 'securise',
  'assurance-vie': 'investissement',
  bourse: 'investissement',
  'commun-immo': 'securise',
  autre: 'securise',
};

type AgeFieldProps = { age: number | null; onCommit: (age: number | null) => void };

const parseAge = (value: string): number | null => (value.trim() === '' ? null : Number(value));

const AgeField = ({ age, onCommit }: AgeFieldProps) => {
  const [value, setValue] = useState(age === null ? '' : String(age));
  const parsed = parseAge(value);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed > 0 && parsed < 120);
  return (
    <Field label="Âge" error={valid ? null : 'Âge invalide'}>
      <Input
        value={value}
        inputMode="numeric"
        placeholder="Ex. 35"
        onChange={setValue}
        onBlur={() => {
          if (valid && parsed !== age) {
            onCommit(parsed);
          }
        }}
      />
    </Field>
  );
};

const ProfileCard = () => {
  const dataset = useDataset();
  const actions = useFinanceActions();
  const { settings } = dataset;
  return (
    <Card title="Mode de suivi et budget de départ">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Segmented<TrackingMode>
            value={settings.mode}
            label="Mode de suivi"
            onChange={(mode) => void actions.updateSettings({ mode }, `Mode de suivi : ${mode}`)}
            options={[
              { value: 'simple', label: 'Simplifié (enveloppe personnelle)' },
              { value: 'complet', label: 'Complet' },
            ]}
          />
          <Text variant="small">
            {settings.mode === 'simple'
              ? 'Seuls l’épargne personnelle et le budget plaisir sont suivis, à l’intérieur de ton enveloppe. Les charges communes et le projet immobilier sont considérés comme déjà déduits : ils ne sont ni affichés ni comptés, ce qui évite tout double comptage.'
              : 'Revenus, charges fixes, épargne et plaisir sont suivis à partir de toutes les opérations du compte courant. L’enveloppe personnelle n’est plus utilisée dans les calculs.'}
          </Text>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Enveloppe personnelle mensuelle">
            <MoneyInput
              key={`env-${settings.personalEnvelope}`}
              cents={settings.personalEnvelope}
              label="Enveloppe personnelle"
              onCommit={(personalEnvelope) =>
                void actions.updateSettings({ personalEnvelope }, 'Enveloppe personnelle modifiée')
              }
            />
          </Field>
          <AgeField
            key={settings.age ?? 'vide'}
            age={settings.age}
            onCommit={(age) => void actions.updateSettings({ age }, null)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Text variant="label">Thème</Text>
          <Segmented<ThemePreference>
            value={settings.theme}
            label="Thème"
            onChange={(theme) => void actions.updateSettings({ theme }, null)}
            options={[
              { value: 'system', label: 'Système' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
          />
        </div>
      </div>
    </Card>
  );
};

type AccountRowProps = { account: Account; isMain: boolean };

const AccountRow = ({ account, isMain }: AccountRowProps) => {
  const actions = useFinanceActions();
  const [name, setName] = useState(account.name);
  const [openingDate, setOpeningDate] = useState(account.openingDate);
  const save = (patch: Partial<Account>) => void actions.saveAccount({ ...account, ...patch }, false);
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
        <Select
          value={account.kind}
          onChange={(kind) =>
            save({
              kind: kind as AccountKind,
              group: GROUP_BY_KIND[kind as AccountKind],
              isJoint: kind === 'commun-immo',
            })
          }
          label="Type de compte"
          className="h-9"
          options={Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => ({ value, label }))}
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
  const actions = useFinanceActions();
  const add = () => {
    const account: Account = {
      id: newId(),
      name: 'Nouveau compte',
      kind: 'livret',
      group: 'securise',
      openingBalance: 0,
      openingDate: todayIso(),
      isJoint: false,
      personalSharePercent: null,
      archived: false,
      color: '#64748b',
    };
    void actions.saveAccount(account, true);
  };
  return (
    <Card
      title="Comptes"
      subtitle="Solde de départ à une date donnée : les opérations antérieures à cette date sont considérées comme incluses dans ce solde"
      padded={false}
      action={
        <Button size="sm" icon={Plus} onClick={add}>
          Ajouter un compte
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Solde de départ</th>
              <th>À la date du</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {dataset.accounts.map((account) => (
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
            void actions.updateSettings({ mainAccountId }, 'Compte principal modifié')
          }
          className="w-56"
          label="Compte principal"
          options={dataset.accounts
            .filter((account) => !account.archived)
            .map((account) => ({ value: account.id, label: account.name }))}
        />
      </div>
    </Card>
  );
};

type CategoryRowProps = { category: Category };

const PERIOD_GROUPS: CategoryGroup[] = ['fixe', 'plaisir'];

const CategoryRow = ({ category }: CategoryRowProps) => {
  const actions = useFinanceActions();
  const [name, setName] = useState(category.name);
  return (
    <li className={`flex flex-col gap-1 ${category.archived ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={setName}
          onBlur={() =>
            name.trim() &&
            name !== category.name &&
            void actions.saveCategory({ ...category, name: name.trim() }, false)
          }
          label="Nom de la catégorie"
          className="h-9"
        />
        <Button
          variant="ghost"
          size="sm"
          icon={category.archived ? ArchiveRestore : Archive}
          label={category.archived ? 'Réactiver' : 'Archiver'}
          onClick={() => void actions.saveCategory({ ...category, archived: !category.archived }, false)}
        />
      </div>
      {PERIOD_GROUPS.includes(category.group) && (
        <Segmented<BudgetPeriod>
          value={category.period}
          label={`Période de budget ${category.name}`}
          onChange={(period) => void actions.saveCategory({ ...category, period }, false)}
          options={[
            { value: 'mensuel', label: 'Mensuel' },
            { value: 'annuel', label: 'Annuel' },
          ]}
        />
      )}
    </li>
  );
};

const CategoriesCard = () => {
  const dataset = useDataset();
  const actions = useFinanceActions();
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<CategoryGroup>('plaisir');
  const add = async () => {
    if (!newName.trim()) {
      return;
    }
    if (
      await actions.saveCategory(
        { id: newId(), name: newName.trim(), group: newGroup, period: 'mensuel', archived: false },
        true,
      )
    ) {
      setNewName('');
    }
  };
  return (
    <Card
      title="Catégories"
      subtitle="« Annuel » : la catégorie sort du budget mensuel et se suit sur l’année (voyages, cadeaux…). Une catégorie archivée reste dans l’historique mais n’est plus proposée."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(GROUP_LABELS) as CategoryGroup[]).map((group) => (
          <div key={group}>
            <Text variant="label" className="mb-2">
              {GROUP_LABELS[group]}
            </Text>
            <ul className="flex flex-col gap-1.5">
              {dataset.categories
                .filter((category) => category.group === group)
                .map((category) => (
                  <CategoryRow key={category.id} category={category} />
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-2">
        <Field label="Nouvelle catégorie">
          <Input value={newName} onChange={setNewName} placeholder="Ex. Sport" />
        </Field>
        <Field label="Groupe">
          <Select
            value={newGroup}
            onChange={(value) => setNewGroup(value as CategoryGroup)}
            options={Object.entries(GROUP_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Button icon={Plus} onClick={() => void add()}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
};

const BackupCard = () => {
  const dataset = useDataset();
  const { isDemo } = useFinanceState();
  const actions = useFinanceActions();
  const { notify } = useToast();
  const [pending, setPending] = useState<Dataset | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const stamp = todayIso();

  const exportJson = () => {
    downloadTextFile(
      `mes-finances-sauvegarde-${stamp}${isDemo ? '-demo' : ''}.json`,
      JSON.stringify(createBackup(dataset, new Date().toISOString()), null, 2),
      'application/json',
    );
    notify('Sauvegarde exportée');
  };

  const onFile = async (file: File) => {
    const text = await readFileText(file);
    if (!text.ok) {
      notify(text.message, 'error');
      return;
    }
    const json = parseJsonText(text.value);
    if (!json.ok) {
      notify(json.message, 'error');
      return;
    }
    const backup = readBackup(json.value);
    if (!backup.ok) {
      notify(backup.reason, 'error');
      return;
    }
    setPending(backup.dataset);
  };

  return (
    <Card
      title="Sauvegardes"
      subtitle="Tes données restent dans ce navigateur. Exporte régulièrement une sauvegarde : c’est ta seule copie de sécurité."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-xl border border-stone-100 p-4 dark:border-stone-800">
          <Text variant="strong">Sauvegarde complète</Text>
          <Text variant="small">
            Comptes, opérations, budgets, objectifs, paramètres et historique (JSON).
          </Text>
          <Button icon={Download} variant="primary" onClick={exportJson} className="mt-auto">
            Exporter la sauvegarde
          </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-stone-100 p-4 dark:border-stone-800">
          <Text variant="strong">Restaurer</Text>
          <Text variant="small">
            Remplace toutes les données actuelles par celles du fichier. Une confirmation est demandée.
          </Text>
          <label className="mt-auto inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-stone-800 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700">
            <Upload className="h-4 w-4" aria-hidden />
            Choisir un fichier
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  void onFile(file);
                }
              }}
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-stone-100 p-4 dark:border-stone-800">
          <Text variant="strong">Export des opérations</Text>
          <Text variant="small">
            Toutes les opérations au format CSV (séparateur « ; »), lisible dans un tableur.
          </Text>
          <Button
            icon={Download}
            className="mt-auto"
            onClick={() =>
              downloadTextFile(
                `mes-finances-operations-${stamp}.csv`,
                `﻿${transactionsToCsv(dataset.transactions, dataset.categories, dataset.accounts)}`,
                'text/csv',
              )
            }
          >
            Exporter en CSV
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/40">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
          <div>
            <Text variant="strong">Données de démonstration</Text>
            <Text variant="small">
              Stockées dans une base séparée : passer en mode démo ne touche jamais à tes données réelles.
            </Text>
          </div>
        </div>
        <Button icon={FlaskConical} onClick={() => void actions.setDemo(!isDemo)}>
          {isDemo ? 'Revenir à mes données' : 'Explorer la démo'}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Text variant="small">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-600" aria-hidden />
          Aucune donnée n’est transmise à un serveur. Aucune connexion bancaire.
        </Text>
        <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
          Réinitialiser {isDemo ? 'la démo' : 'mes données'}
        </Button>
      </div>
      {pending && (
        <ConfirmDialog
          title="Restaurer cette sauvegarde ?"
          message={`Les données actuelles seront remplacées par la sauvegarde (${pending.transactions.length} opérations, ${pending.accounts.length} comptes). Exporte d’abord une sauvegarde de l’état actuel si tu veux pouvoir revenir en arrière.`}
          confirmLabel="Restaurer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            void actions.restore(pending);
            setPending(null);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Tout réinitialiser ?"
          message="Toutes les opérations, budgets et objectifs seront effacés et la configuration initiale rétablie. Cette action est irréversible sans sauvegarde."
          confirmLabel="Réinitialiser"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            void actions.resetAll();
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

const ParametresPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader title="Paramètres et sauvegardes" />
    <ProfileCard />
    <BackupCard />
    <AccountsCard />
    <CategoriesCard />
    <AuditCard />
  </div>
);

export default ParametresPage;
