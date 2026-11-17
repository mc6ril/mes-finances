import type { ThemePreference, WorkspaceKind } from '@/core/shared/model';
import { DEFAULT_HOUSEHOLD } from '@/core/shared/seed';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Card from '@/ui/components/molecules/cards/Card';
import PreferenceRow from '@/ui/components/molecules/form/PreferenceRow';
import Segmented from '@/ui/components/molecules/Segmented';
import HouseholdSettings from './HouseholdSettings';

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
      <div className="divide-y divide-line">
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

export default ProfileCard;
