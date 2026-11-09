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
import LineEditor from './LineEditor';

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

type CalculationLineProps = { label: string; amount: Cents; sign?: '+' | '−'; total?: boolean };

const CalculationLine = ({ label, amount, sign, total = false }: CalculationLineProps) => (
  <div
    className={cx(
      'flex items-baseline justify-between gap-4 py-1.5 text-sm',
      total
        ? 'mt-1 border-t border-stone-200 pt-2.5 font-semibold text-stone-900 dark:border-stone-700 dark:text-stone-50'
        : 'text-stone-600 dark:text-stone-300',
    )}
  >
    <span>
      {sign && <span className="inline-block w-4 text-stone-400">{sign}</span>}
      {label}
    </span>
    <Amount cents={amount} colored={total} />
  </div>
);

/** Le mois du compte commun : revenus, enveloppe, parts, épargne, report et reste du mois. */
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

  return (
    <Card title="Le mois du commun" subtitle="Revenus du couple, part de chacun, épargne et reste du mois">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <Section
            title="Revenus et part de chacun"
            hint="Chacun verse au commun au prorata de ses revenus du mois."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {members.map((member) => {
                const income = summary.incomes[member.id] ?? 0;
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-stone-200 p-4 dark:border-stone-800"
                  >
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <Text variant="strong">{memberLabel(dataset, member.id)}</Text>
                      <Text variant="small">
                        Revenus{' '}
                        <Amount cents={income} className="font-medium text-stone-900 dark:text-stone-50" />
                      </Text>
                    </div>
                    <LineEditor
                      lines={entry.incomes.filter((line) => line.memberId === member.id)}
                      defaultLabel="Salaire"
                      addLabel="Ajouter un revenu"
                      onChange={(lines) =>
                        save({
                          incomes: [
                            ...entry.incomes.filter((line) => line.memberId !== member.id),
                            ...lines.map((line) => ({ ...line, memberId: member.id })),
                          ],
                        })
                      }
                    />
                    <div className="mt-3 flex items-baseline justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
                      <Text variant="small">
                        Part du commun
                        {summary.totalIncome > 0 && ` · ${percent(income / summary.totalIncome)}`}
                      </Text>
                      <Amount
                        cents={summary.contributions[member.id] ?? 0}
                        className="font-semibold text-stone-900 dark:text-stone-50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            title="Enveloppe commune"
            hint={`Proposée : ${formatEuros(summary.suggestedEnvelope)}, soit ${percent(rate)} de ${formatEuros(summary.totalIncome)} arrondi aux 50 € supérieurs.`}
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
          </Section>

          <Section title="Épargne et entrées du mois">
            <div className="flex flex-col gap-6">
              <div>
                <Text variant="label" className="mb-2">
                  Épargne, en % de l’enveloppe
                </Text>
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
              </div>
              <div>
                <Text variant="label" className="mb-2">
                  Entrées ponctuelles
                </Text>
                <LineEditor
                  lines={entry.inflows}
                  defaultLabel="Intérêts"
                  addLabel="Ajouter une entrée"
                  allowNegative
                  onChange={(inflows) => save({ inflows })}
                />
                <Text variant="caption" className="mt-2">
                  Intérêts, retrait d’épargne pour un projet… Un montant négatif est une sortie.
                </Text>
              </div>
            </div>
          </Section>
        </div>
        <aside className="lg:border-l lg:border-stone-100 lg:pl-8 dark:lg:border-stone-800">
          <div className="lg:sticky lg:top-6">
            <Title level={3}>Récapitulatif</Title>
            <div className="mt-4">
              <CalculationLine label="Enveloppe commune" amount={summary.envelope} />
              <CalculationLine label="Report du mois précédent" amount={summary.carriedOver} sign="+" />
              <CalculationLine label="Entrées ponctuelles" amount={summary.inflows} sign="+" />
              <CalculationLine label="Épargne" amount={summary.savingsTotal} sign="−" />
              <CalculationLine label="Disponible" amount={summary.available} total />
              <CalculationLine label="Dépenses du mois" amount={summary.expenses} sign="−" />
              <CalculationLine label="Reste du mois" amount={summary.balance} total />
            </div>
            <Text variant="caption" className="mt-3">
              Le reste du mois est reporté sur le mois suivant, arrondi à l’euro.
            </Text>
          </div>
        </aside>
      </div>
    </Card>
  );
};

export default CommonMonthCard;
