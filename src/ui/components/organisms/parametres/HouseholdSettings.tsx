import { useState } from 'react';
import { defaultMemberName, memberName, SAVINGS_FROM_COMMON, savingsPayerOf } from '@/core/commun/household';
import { formatRate, rateInput } from '@/core/shared/format';
import { parsePercent } from '@/core/shared/money';
import type { Household, HouseholdMember } from '@/core/shared/model';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { Input } from '@/ui/components/atoms/form/Input';
import Segmented from '@/ui/components/molecules/Segmented';
import SettingRow from '@/ui/components/molecules/form/PreferenceRow';
import { cx } from '@/ui/design-system/cx';

type NameInputProps = { member: HouseholdMember; index: number; onSave: (name: string) => void };

const NameInput = ({ member, index, onSave }: NameInputProps) => {
  const [name, setName] = useState(member.name);
  return (
    <Input
      value={name}
      onChange={setName}
      onBlur={() => name.trim() !== member.name && onSave(name.trim())}
      placeholder={defaultMemberName(index)}
      label={`Prénom du membre ${index + 1}`}
    />
  );
};

/** Réglages d'un espace commun, en lignes simples : membres, salaire sur le commun, part versée. */
const HouseholdSettings = ({ household }: { household: Household }) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [rate, setRate] = useState(rateInput(household.contributionRate));

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

  const setSalaryOnCommon = (memberId: string, salaryOnCommon: boolean) =>
    save(
      {
        ...household,
        members: household.members.map((member) =>
          member.id === memberId ? { ...member, salaryOnCommon } : member,
        ),
      },
      'Salaire versé sur le commun modifié',
    );

  const commitRate = () => {
    // Part versée au commun : strictement positive, 100 % au plus ; un champ vide est refusé.
    const parsed = parsePercent(rate, { minExclusive: true });
    if (!parsed.ok || parsed.value === null) {
      setRate(rateInput(household.contributionRate));
      return;
    }
    const next = parsed.value / 100;
    if (next !== household.contributionRate) {
      save({ ...household, contributionRate: next }, `Part versée au commun : ${formatRate(next)}`);
    }
  };

  return (
    <>
      <SettingRow label="Membres" hint="Les deux personnes qui partagent le compte.">
        <div className="grid w-full gap-2 sm:w-104 sm:grid-cols-2">
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
        hint="Cochez chaque personne payée sur le compte commun (les deux, une seule ou aucune). En fin de mois, le commun lui reverse ce qui dépasse sa part ; les autres versent leur part depuis leur compte."
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {household.members.map((member) => {
            const name = memberName(household.members, member.id);
            return (
              <Checkbox
                key={member.id}
                checked={member.salaryOnCommon}
                label={`Salaire de ${name} versé sur le commun`}
                onChange={(checked) => setSalaryOnCommon(member.id, checked)}
              >
                {name}
              </Checkbox>
            );
          })}
        </div>
      </SettingRow>
      <SettingRow
        label="Épargne du mois versée depuis"
        hint="Le compte d’où partent les virements vers les livrets. Versée par une personne : elle compte dans sa part."
      >
        <Segmented<string>
          value={savingsPayerOf(household) ?? SAVINGS_FROM_COMMON}
          label="Épargne du mois versée depuis"
          onChange={(payer) =>
            save({ ...household, savingsPaidBy: payer }, 'Origine de l’épargne du commun modifiée')
          }
          options={[
            { value: SAVINGS_FROM_COMMON, label: 'Compte commun' },
            ...household.members.map((member) => ({
              value: member.id,
              label: memberName(household.members, member.id),
            })),
          ]}
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
          <span
            className={cx(
              'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm',
              'text-ink-muted',
            )}
          >
            %
          </span>
        </span>
      </SettingRow>
    </>
  );
};

export default HouseholdSettings;
