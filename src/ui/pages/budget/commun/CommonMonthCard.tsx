import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import {
  commonMonthOf,
  commonMonthSummary,
  effectiveSavingsRates,
  memberLabel,
  membersOf,
} from '@/core/commun/household';
import { formatEuros } from '@/core/shared/format';
import type { CommonMonth, MonthKey, SavingsRate } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Amount from '@/ui/design-system/Amount';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Input, Select } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';
import Text from '@/ui/design-system/Text';
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
    <span className="relative w-16">
      <Input
        value={text}
        onChange={setText}
        onBlur={commit}
        label={label}
        inputMode="decimal"
        className="h-8 pr-5 text-right"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
        %
      </span>
    </span>
  );
};

type Step = { label: string; amount: number; sign?: '+' | '−' | '=' };

const Equation = ({ steps }: { steps: Step[] }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
    {steps.map((step) => (
      <div key={step.label} className="contents">
        <dt
          className={
            step.sign === '='
              ? 'border-t border-stone-200 pt-1 font-semibold text-stone-900 dark:border-stone-800 dark:text-stone-50'
              : 'text-stone-600 dark:text-stone-300'
          }
        >
          {step.sign && step.sign !== '=' ? `${step.sign} ` : ''}
          {step.label}
        </dt>
        <dd
          className={
            step.sign === '='
              ? 'border-t border-stone-200 pt-1 text-right font-semibold dark:border-stone-800'
              : 'text-right'
          }
        >
          <Amount cents={step.amount} colored={step.sign === '='} />
        </dd>
      </div>
    ))}
  </dl>
);

/** Le mois du compte commun : revenus, enveloppe, contributions, épargne, report et bilan. */
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
      <div className="grid gap-6 lg:grid-cols-3">
        <section>
          <Text variant="label" className="mb-2">
            Revenus du mois
          </Text>
          <div className="flex flex-col gap-4">
            {members.map((member) => (
              <div key={member.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <Text variant="strong">{memberLabel(dataset, member.id)}</Text>
                  <Amount cents={summary.incomes[member.id] ?? 0} className="text-sm font-semibold" />
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
              </div>
            ))}
          </div>
        </section>

        <section>
          <Text variant="label" className="mb-2">
            Enveloppe commune
          </Text>
          <div className="flex items-center gap-2">
            <MoneyInput
              key={`${month}-${summary.envelope}`}
              cents={summary.envelope}
              label="Enveloppe du mois"
              className="w-36"
              onCommit={(cents) => save({ envelope: cents === summary.suggestedEnvelope ? null : cents })}
            />
            {entry.envelope !== null && (
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                label="Revenir à l’enveloppe proposée"
                onClick={() => save({ envelope: null })}
              />
            )}
          </div>
          <Text variant="caption" className="mt-1">
            Proposée : {formatEuros(summary.suggestedEnvelope)} ({percent(rate)} de{' '}
            {formatEuros(summary.totalIncome)}, arrondi aux 50 € supérieurs)
          </Text>
          <ul className="mt-3 flex flex-col gap-1.5">
            {members.map((member) => {
              const income = summary.incomes[member.id] ?? 0;
              return (
                <li key={member.id} className="flex items-baseline justify-between text-sm">
                  <span className="text-stone-600 dark:text-stone-300">
                    Part de {memberLabel(dataset, member.id)}
                    {summary.totalIncome > 0 && (
                      <span className="text-stone-400"> · {percent(income / summary.totalIncome)}</span>
                    )}
                  </span>
                  <Amount cents={summary.contributions[member.id] ?? 0} className="font-medium" />
                </li>
              );
            })}
          </ul>

          <Text variant="label" className="mb-2 mt-5">
            Entrées ponctuelles
          </Text>
          <LineEditor
            lines={entry.inflows}
            defaultLabel="Intérêts"
            addLabel="Ajouter une entrée"
            allowNegative
            onChange={(inflows) => save({ inflows })}
          />
        </section>

        <section>
          <Text variant="label" className="mb-2">
            Épargne du mois
          </Text>
          <ul className="flex flex-col gap-1.5">
            {summary.savings.map((line, index) => (
              <li key={`${line.accountId}-${index}`} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">
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
                <Amount cents={line.amount} className="w-24 text-right font-medium" />
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
            <div className="mt-1 flex items-center gap-2">
              <Select
                value=""
                label="Ajouter une épargne"
                className="h-8 w-full text-xs"
                onChange={(accountId) => accountId && saveRates([...savingsRates, { accountId, rate: 0.1 }])}
                options={[
                  { value: '', label: '+ Ajouter une épargne…' },
                  ...savingsAccounts.map((account) => ({ value: account.id, label: account.name })),
                ]}
              />
            </div>
          )}
          {entry.savingsRates === null && savingsRates.length > 0 && (
            <Text variant="caption" className="mt-1">
              Taux repris du mois précédent ; une modification ne vaut qu’à partir de ce mois.
            </Text>
          )}

          <div className="mt-5 rounded-xl bg-stone-50 p-3 dark:bg-stone-900/60">
            <Equation
              steps={[
                { label: 'Enveloppe', amount: summary.envelope },
                { label: 'Report du mois précédent', amount: summary.carriedOver, sign: '+' },
                { label: 'Entrées ponctuelles', amount: summary.inflows, sign: '+' },
                { label: 'Épargne', amount: summary.savingsTotal, sign: '−' },
                { label: 'Disponible', amount: summary.available, sign: '=' },
                { label: 'Dépenses du mois', amount: summary.expenses, sign: '−' },
                { label: 'Reste du mois', amount: summary.balance, sign: '=' },
              ]}
            />
          </div>
        </section>
      </div>
    </Card>
  );
};

export default CommonMonthCard;
