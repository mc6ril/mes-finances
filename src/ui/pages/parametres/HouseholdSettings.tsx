import { useState } from 'react';
import type { Household, HouseholdMember } from '@/core/shared/model';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { Input } from '@/ui/design-system/Field';
import Segmented from '@/ui/design-system/Segmented';
import SettingRow from './SettingRow';

const percentText = (rate: number): string => String(Math.round(rate * 1000) / 10).replace('.', ',');

const parsePercent = (text: string): number | null => {
  const value = Number(text.replace(',', '.').replace('%', '').trim());
  return Number.isFinite(value) && value > 0 && value <= 100 ? value / 100 : null;
};

type NameInputProps = { member: HouseholdMember; index: number; onSave: (name: string) => void };

const NameInput = ({ member, index, onSave }: NameInputProps) => {
  const [name, setName] = useState(member.name);
  return (
    <Input
      value={name}
      onChange={setName}
      onBlur={() => name.trim() !== member.name && onSave(name.trim())}
      placeholder={`Personne ${index + 1}`}
      label={`Prénom de la personne ${index + 1}`}
    />
  );
};

/** Réglages d'un espace commun, en lignes simples : membres, salaire sur le commun, part versée. */
const HouseholdSettings = ({ household }: { household: Household }) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [rate, setRate] = useState(percentText(household.contributionRate));

  const save = (next: Household, summary: string) =>
    void report(finance.updateSettings({ household: next }, summary), null);

  const rename = (memberId: string, name: string) =>
    save(
      {
        ...household,
        members: household.members.map((member) => (member.id === memberId ? { ...member, name } : member)),
      },
      'Membres du compte commun modifiés',
    );

  const setSalaryOnCommon = (memberId: string) =>
    save(
      {
        ...household,
        members: household.members.map((member) => ({ ...member, salaryOnCommon: member.id === memberId })),
      },
      'Salaire versé sur le commun modifié',
    );

  const commitRate = () => {
    const parsed = parsePercent(rate);
    if (parsed === null) {
      setRate(percentText(household.contributionRate));
      return;
    }
    if (parsed !== household.contributionRate) {
      save({ ...household, contributionRate: parsed }, `Part versée au commun : ${percentText(parsed)} %`);
    }
  };

  const onCommon = household.members.find((member) => member.salaryOnCommon)?.id ?? '';

  return (
    <>
      <SettingRow label="Membres" hint="Les deux personnes qui partagent le compte.">
        <div className="grid w-full gap-2 sm:w-[26rem] sm:grid-cols-2">
          {household.members.map((member, index) => (
            <NameInput
              key={member.id}
              member={member}
              index={index}
              onSave={(name) => rename(member.id, name)}
            />
          ))}
        </div>
      </SettingRow>
      <SettingRow
        label="Salaire versé sur le commun"
        hint="Il récupère son solde en fin de mois ; l’autre verse sa part."
      >
        <Segmented<string>
          value={onCommon}
          label="Salaire versé sur le commun"
          onChange={setSalaryOnCommon}
          options={household.members.map((member, index) => ({
            value: member.id,
            label: member.name.trim() || `Personne ${index + 1}`,
          }))}
        />
      </SettingRow>
      <SettingRow
        label="Part des revenus versée au commun"
        hint="Chacun contribue au prorata de ses revenus. L’enveloppe est arrondie aux 50 € supérieurs."
      >
        <span className="relative inline-block w-28">
          <Input
            value={rate}
            onChange={setRate}
            onBlur={commitRate}
            inputMode="decimal"
            label="Part versée au commun"
            className="pr-8 text-right"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
            %
          </span>
        </span>
      </SettingRow>
    </>
  );
};

export default HouseholdSettings;
