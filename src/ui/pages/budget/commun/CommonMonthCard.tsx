import { RotateCcw, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  commonMonthOf,
  commonMonthSummary,
  effectiveSavingsRates,
  memberLabel,
  membersOf,
} from '@/core/commun/household';
import { formatEuros } from '@/core/shared/format';
import type { Cents, CommonMonth, MonthKey, SavingsRate } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Amount from '@/ui/design-system/Amount';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { cx } from '@/ui/design-system/cx';
import { Input, Select } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';

const percent = (rate: number): string => `${String(Math.round(rate * 1000) / 10).replace('.', ',')} %`;

type RatePercentProps = { rate: number; onCommit: (rate: number) => void; label: string };

/** Pourcentage saisi en clair (« 10 » ou « 12,5 »), validé à la sortie du champ. */
const RatePercent = ({ rate, onCommit, label }: RatePercentProps) => {
  const initial = String(Math.round(rate * 1000) / 10).replace('.', ',');
  const [text, setText] = useState(initial);
  const commit = () => {
    const value = Number(text.replace(',', '.').trim());
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setText(initial);
      return;
    }
    if (value / 100 !== rate) {
      onCommit(value / 100);
    }
  };
  return (
    <span className="relative inline-block w-20">
      <Input
        value={text}
        onChange={setText}
        onBlur={commit}
        label={label}
        inputMode="decimal"
        className="h-9 pr-7 text-right"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">
        %
      </span>
    </span>
  );
};

type SectionProps = { title: string; hint?: string; children: ReactNode };

const Section = ({ title, hint, children }: SectionProps) => (
  <section className="border-t border-stone-100 py-6 first:border-t-0 first:pt-0 last:pb-0 dark:border-stone-800">
    <div className="mb-4">
      <Title level={3}>{title}</Title>
      {hint && (
        <Text variant="small" className="mt-0.5">
          {hint}
        </Text>
      )}
    </div>
    {children}
  </section>
);

type CalculationLineProps = {
  label: string;
  amount: Cents;
  detail?: string;
  sign?: '+' | '−';
  total?: boolean;
  neutral?: boolean;
};

const CalculationLine = ({
  label,
  amount,
  detail,
  sign,
  total = false,
  neutral = false,
}: CalculationLineProps) => (
  <div
    className={cx(
      'flex items-baseline justify-between gap-4 py-1.5 text-sm',
      total
        ? 'mt-1 border-t border-stone-200 pt-2.5 font-semibold text-stone-900 dark:border-stone-700 dark:text-stone-50'
        : 'text-stone-600 dark:text-stone-300',
    )}
  >
    <span className="min-w-0">
      {sign && <span className="inline-block w-4 text-stone-400">{sign}</span>}
      {label}
      {detail && <span className="block text-xs font-normal text-stone-400">{detail}</span>}
    </span>
    <Amount cents={amount} colored={total && !neutral} />
  </div>
);

/** Le mois du compte commun : enveloppe et épargne à gauche, récapitulatif du calcul à droite. */
const CommonMonthCard = ({ month }: { month: MonthKey }) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const entry = commonMonthOf(dataset, month);
  const summary = commonMonthSummary(dataset, month);
  const members = membersOf(dataset);
  const rate = dataset.settings.household?.contributionRate ?? 0;
  const savingsRates = effectiveSavingsRates(dataset.commonMonths, month);
  const savingsAccounts = dataset.accounts.filter(
    (account) => !account.archived && account.group !== 'courant',
  );

  const save = (patch: Partial<CommonMonth>) => void report(finance.saveCommonMonth({ ...entry, ...patch }));
  const saveRates = (rates: SavingsRate[]) => save({ savingsRates: rates });
  const accountName = (accountId: string) =>
    dataset.accounts.find((account) => account.id === accountId)?.name ?? 'Compte supprimé';
  const shareOf = (memberId: string): string | undefined =>
    summary.totalIncome > 0
      ? `${percent((summary.incomes[memberId] ?? 0) / summary.totalIncome)} · part ${formatEuros(summary.contributions[memberId] ?? 0)}`
      : undefined;

  return (
    <Card title="Le mois du commun" subtitle="Enveloppe, épargne et reste du mois">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Section
            title="Enveloppe commune"
            hint={`Proposée : ${formatEuros(summary.suggestedEnvelope)}, soit ${percent(rate)} des revenus du mois (${formatEuros(summary.totalIncome)}) arrondi aux 50 € supérieurs.`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <MoneyInput
                key={`${month}-${summary.envelope}`}
                cents={summary.envelope}
                label="Enveloppe du mois"
                className="w-40"
                onCommit={(cents) => save({ envelope: cents === summary.suggestedEnvelope ? null : cents })}
              />
              {entry.envelope !== null && (
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => save({ envelope: null })}>
                  Revenir à l’enveloppe proposée
                </Button>
              )}
            </div>
            {summary.totalIncome === 0 && (
              <Text variant="caption" className="mt-2">
                Aucun revenu ce mois-ci : ajoute les salaires dans Compte courant (type Revenu, « De qui »).
              </Text>
            )}
          </Section>

          <Section
            title="Épargne du mois"
            hint="En pourcentage de l’enveloppe, versé sur les comptes d’épargne."
          >
            <ul className="flex flex-col">
              {summary.savings.map((line, index) => (
                <li
                  key={`${line.accountId}-${index}`}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-b-0 dark:border-stone-800"
                >
                  <span className="min-w-0 flex-1 text-sm text-stone-700 dark:text-stone-200">
                    {accountName(line.accountId)}
                  </span>
                  <RatePercent
                    key={`${month}-${line.accountId}-${line.rate}`}
                    rate={line.rate}
                    label={`Pourcentage pour ${accountName(line.accountId)}`}
                    onCommit={(next) =>
                      saveRates(
                        savingsRates.map((item, position) =>
                          position === index ? { ...item, rate: next } : item,
                        ),
                      )
                    }
                  />
                  <Amount cents={line.amount} className="w-24 text-right text-sm font-medium" />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={X}
                    label={`Retirer ${accountName(line.accountId)}`}
                    onClick={() => saveRates(savingsRates.filter((_, position) => position !== index))}
                  />
                </li>
              ))}
            </ul>
            {savingsAccounts.length > 0 && (
              <div className="mt-2 w-full sm:w-64">
                <Select
                  value=""
                  label="Ajouter une épargne"
                  onChange={(accountId) =>
                    accountId && saveRates([...savingsRates, { accountId, rate: 0.1 }])
                  }
                  options={[
                    { value: '', label: '+ Ajouter une épargne…' },
                    ...savingsAccounts.map((account) => ({ value: account.id, label: account.name })),
                  ]}
                />
              </div>
            )}
            {entry.savingsRates === null && savingsRates.length > 0 && (
              <Text variant="caption" className="mt-2">
                Taux repris du mois précédent. Une modification ne vaut qu’à partir de ce mois.
              </Text>
            )}
          </Section>
        </div>

        <aside className="lg:border-l lg:border-stone-100 lg:pl-8 dark:lg:border-stone-800">
          <div className="lg:sticky lg:top-6">
            <Title level={3}>Récapitulatif</Title>
            <div className="mt-4">
              {members.map((member) => (
                <CalculationLine
                  key={member.id}
                  label={`Revenus ${memberLabel(dataset, member.id)}`}
                  detail={shareOf(member.id)}
                  amount={summary.incomes[member.id] ?? 0}
                />
              ))}
              <CalculationLine
                label="Enveloppe commune"
                detail={`${percent(rate)} des revenus, arrondie`}
                amount={summary.envelope}
                total
                neutral
              />
              <CalculationLine label="Report du mois précédent" amount={summary.carriedOver} sign="+" />
              <CalculationLine label="Autres entrées" amount={summary.inflows} sign="+" />
              <CalculationLine label="Épargne" amount={summary.savingsTotal} sign="−" />
              <CalculationLine label="Disponible" amount={summary.available} total />
              <CalculationLine label="Dépenses du mois" amount={summary.expenses} sign="−" />
              <CalculationLine label="Reste du mois" amount={summary.balance} total />
            </div>
            <Text variant="caption" className="mt-3">
              Les revenus viennent des opérations de type Revenu. Le reste du mois est reporté sur le mois
              suivant, arrondi à l’euro.
            </Text>
          </div>
        </aside>
      </div>
    </Card>
  );
};

export default CommonMonthCard;
