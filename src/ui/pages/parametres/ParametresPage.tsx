import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import Tabs from '@/ui/components/molecules/Tabs';
import { SETTINGS_TABS, settingsPath, type SettingsTab } from '@/ui/routing/navigation';
import PageHeader from '@/ui/components/molecules/PageHeader';
import AccountCard from '@/ui/components/organisms/parametres/AccountCard';
import AccountsCard from '@/ui/components/organisms/parametres/AccountsCard';
import AuditCard from '@/ui/components/organisms/parametres/AuditCard';
import BackupCard from '@/ui/components/organisms/parametres/BackupCard';
import CategoriesCard from '@/ui/components/organisms/parametres/CategoriesCard';
import ImportRulesCard from '@/ui/components/organisms/parametres/ImportRulesCard';
import ProfileCard from '@/ui/components/organisms/parametres/ProfileCard';
import SavingsAccountsNotice from '@/ui/components/organisms/parametres/SavingsAccountsNotice';
import WorkspacesCard from '@/ui/components/organisms/parametres/WorkspacesCard';

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
