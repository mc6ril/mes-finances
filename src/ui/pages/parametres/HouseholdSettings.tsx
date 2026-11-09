import { useState } from 'react';
import type { Household, HouseholdMember } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { Field, Input } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';

const percentText = (rate: number): string => String(Math.round(rate * 1000) / 10).replace('.', ',');

const parsePercent = (text: string): number | null => {
  const value = Number(text.replace(',', '.').replace('%', '').trim());
  return Number.isFinite(value) && value > 0 && value <= 100 ? value / 100 : null;
};

type MemberFieldsProps = {
  member: HouseholdMember;
  index: number;
  onSave: (patch: Partial<HouseholdMember>) => void;
};

const MemberFields = ({ member, index, onSave }: MemberFieldsProps) => {
  const [name, setName] = useState(member.name);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
      <Field label={`Personne ${index + 1}`}>
        <Input
          value={name}
          onChange={setName}
          onBlur={() => name.trim() !== member.name && onSave({ name: name.trim() })}
          placeholder="Prénom"
          label={`Prénom de la personne ${index + 1}`}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
        <input
          type="radio"
          name="salary-on-common"
          checked={member.salaryOnCommon}
          onChange={() => onSave({ salaryOnCommon: true })}
          className="accent-blue-600"
        />
        Son salaire arrive sur le compte commun
      </label>
    </div>
  );
};

/** Réglages d'un espace commun : les deux membres et la part des revenus versée au commun. */
const HouseholdSettings = ({ household }: { household: Household }) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const { settings } = useDataset();
  const [rate, setRate] = useState(percentText(household.contributionRate));

  const save = (next: Household, summary: string) =>
    void report(finance.updateSettings({ household: next }, summary), null);

  const saveMember = (memberId: string, patch: Partial<HouseholdMember>) => {
    const members = household.members.map((member) => {
      if (patch.salaryOnCommon) {
        return { ...member, salaryOnCommon: member.id === memberId };
      }
      return member.id === memberId ? { ...member, ...patch } : member;
    });
    save({ ...household, members }, 'Membres du compte commun modifiés');
  };

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

  return (
    <div className="flex flex-col gap-4" key={settings.kind}>
      <div className="grid gap-3 sm:grid-cols-2">
        {household.members.map((member, index) => (
          <MemberFields
            key={member.id}
            member={member}
            index={index}
            onSave={(patch) => saveMember(member.id, patch)}
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Part des revenus versée au commun (%)"
          hint="L’enveloppe du mois propose ce pourcentage des revenus du couple, arrondi aux 50 € supérieurs."
        >
          <Input
            value={rate}
            onChange={setRate}
            onBlur={commitRate}
            inputMode="decimal"
            label="Part versée au commun"
          />
        </Field>
      </div>
      <Text variant="small">
        Chacun contribue au prorata de ses revenus. En fin de mois, celui dont le salaire arrive sur le commun
        récupère son solde ; l’autre verse sa part.
      </Text>
    </div>
  );
};

export default HouseholdSettings;
