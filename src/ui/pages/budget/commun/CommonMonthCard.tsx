import { Check, PiggyBank, ReceiptText, RotateCcw, Wallet, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  commonMonthOf,
  commonMonthSummary,
  effectiveSavingsRates,
  memberLabel,
  membersOf,
} from '@/core/commun/household';
import { formatDateFr, formatEuros } from '@/core/shared/format';
import type { Cents, CommonMonth, MonthKey, SavingsRate } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Amount from '@/ui/design-system/Amount';
import { cx } from '@/ui/design-system/cx';
import { Input, Select } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';

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
    <span className="relative inline-block w-[72px]">
      <Input
        value={text}
        onChange={setText}
        onBlur={commit}
        label={label}
        inputMode="decimal"
        className="h-8 pr-7 text-right text-sm"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">
        %
      </span>
    </span>
  );
};

type SavingsNameProps = { name: string; accountName?: string; onRename: (label: string) => void };

/** Nom de l'enveloppe d'épargne, modifiable d'un clic ; le compte apparaît dessous s'il diffère. */
const SavingsName = ({ name, accountName, onRename }: SavingsNameProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null) {
    return (
      <span className="min-w-0 flex-1">
        <Input
          value={draft}
          onChange={setDraft}
          autoFocus
          label="Nom de l’épargne"
          className="h-8 text-sm"
          onBlur={() => {
            if (draft.trim() !== name) {
              onRename(draft.trim() === accountName ? '' : draft.trim());
            }
            setDraft(null);
          }}
          onKeyDown={(key) => key === 'Enter' && (document.activeElement as HTMLElement | null)?.blur()}
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setDraft(name)}
      title="Renommer"
      className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
    >
      <span className="block text-sm text-stone-700 dark:text-stone-200">{name}</span>
      {accountName && accountName !== name && (
        <span className="block text-xs text-stone-400">sur {accountName}</span>
      )}
    </button>
  );
};

type Tone = 'brand' | 'emerald' | 'stone';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  stone: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300',
};

type HeadingProps = { icon: LucideIcon; tone: Tone; title: string; hint?: string };

/** Titre de bloc : pastille d'icône teintée, titre et aide alignés sur la même colonne. */
const Heading = ({ icon: Icon, tone, title, hint }: HeadingProps) => (
  <div className="flex items-start gap-3">
    <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONES[tone])}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
    <div className="min-w-0 pt-1">
      <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100">{title}</h3>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  </div>
);

/** Contenu aligné sur le titre (sous le texte, pas sous l'icône). */
const Indented = ({ children }: { children: ReactNode }) => <div className="mt-4 sm:pl-11">{children}</div>;

type RecapLineProps = {
  label: string;
  amount: Cents;
  detail?: string;
  sign?: '+' | '−';
  dot?: string;
  strong?: boolean;
  /** Remplace le montant par un champ (revenu saisi à la main). */
  input?: ReactNode;
};

const RecapLine = ({ label, amount, detail, sign, dot, strong = false, input }: RecapLineProps) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="flex w-3 shrink-0 justify-center text-xs text-stone-400">
        {dot ? <span className="h-2 w-2 -translate-y-px rounded-full" style={{ background: dot }} /> : sign}
      </span>
      <span>
        <span
          className={cx(
            'text-sm',
            strong ? 'font-semibold text-stone-900 dark:text-stone-50' : 'text-stone-600 dark:text-stone-300',
          )}
        >
          {label}
        </span>
        {detail && <span className="block text-xs text-stone-400">{detail}</span>}
      </span>
    </div>
    {input ?? (
      <Amount
        cents={amount}
        className={cx(
          'text-sm',
          strong ? 'font-semibold text-stone-900 dark:text-stone-50' : 'text-stone-700 dark:text-stone-200',
        )}
      />
    )}
  </div>
);

const Divider = () => <div className="my-2 border-t border-stone-200/70 dark:border-stone-700/70" />;

const MEMBER_DOTS = ['#3b82f6', '#a78bfa'];

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
  const accountOf = (accountId: string) => dataset.accounts.find((account) => account.id === accountId);
  const shareOf = (memberId: string): string | undefined =>
    summary.totalIncome > 0
      ? `${percent((summary.incomes[memberId] ?? 0) / summary.totalIncome)} · part ${formatEuros(summary.contributions[memberId] ?? 0)}`
      : undefined;
  const positive = summary.balance >= 0;
  const payer = dataset.settings.household?.savingsPaidBy ?? null;

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white shadow-card dark:border-stone-800 dark:bg-[#1c1c1b] dark:shadow-none">
      <header className="border-b border-stone-100 px-5 py-4 dark:border-stone-800 sm:px-6">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">Le mois du commun</h2>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
          Enveloppe, épargne et reste du mois
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col divide-y divide-stone-100 px-5 dark:divide-stone-800 sm:px-6">
          <div className="py-6">
            <Heading
              icon={Wallet}
              tone="brand"
              title="Enveloppe commune"
              hint={`${percent(rate)} des revenus du mois (${formatEuros(summary.totalIncome)}), arrondi aux 50 € supérieurs.`}
            />
            <Indented>
              <div className="flex flex-wrap items-center gap-3">
                <MoneyInput
                  key={`${month}-${summary.envelope}`}
                  cents={summary.envelope}
                  label="Enveloppe du mois"
                  className="w-36"
                  onCommit={(cents) => save({ envelope: cents === summary.suggestedEnvelope ? null : cents })}
                />
                {entry.envelope === null ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Montant proposé
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => save({ envelope: null })}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    Revenir à {formatEuros(summary.suggestedEnvelope)}
                  </button>
                )}
              </div>
              {summary.totalIncome === 0 && (
                <p className="mt-2 text-xs text-stone-400">
                  Aucun revenu ce mois-ci : le salaire versé sur le commun vient des opérations (type Revenu,
                  « De qui ») ; l’autre se saisit dans le récapitulatif.
                </p>
              )}
            </Indented>
          </div>

          <div className="py-6">
            <Heading
              icon={PiggyBank}
              tone="emerald"
              title="Épargne du mois"
              hint="En pourcentage de l’enveloppe."
            />
            <Indented>
              <ul className="flex flex-col">
                {summary.savings.map((line, index) => {
                  const account = accountOf(line.accountId);
                  const name = line.label?.trim() || account?.name || 'Compte supprimé';
                  return (
                    <li key={`${line.accountId}-${index}`} className="group flex items-center gap-3 py-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: account?.color ?? '#a8a29e' }}
                        aria-hidden
                      />
                      <SavingsName
                        key={`${month}-${index}-${name}`}
                        name={name}
                        accountName={account?.name}
                        onRename={(label) =>
                          saveRates(
                            savingsRates.map((item, position) =>
                              position === index ? { ...item, label: label || undefined } : item,
                            ),
                          )
                        }
                      />
                      <RatePercent
                        key={`${month}-${line.accountId}-${line.rate}`}
                        rate={line.rate}
                        label={`Pourcentage pour ${name}`}
                        onCommit={(next) =>
                          saveRates(
                            savingsRates.map((item, position) =>
                              position === index ? { ...item, rate: next } : item,
                            ),
                          )
                        }
                      />
                      <Amount
                        cents={line.amount}
                        className="w-24 text-right text-sm text-stone-700 dark:text-stone-200"
                      />
                      <button
                        type="button"
                        aria-label={`Retirer ${name}`}
                        onClick={() => saveRates(savingsRates.filter((_, position) => position !== index))}
                        className="rounded-md p-1 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-stone-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-stone-800"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {savingsAccounts.length > 0 && (
                <div className="mt-3 w-full sm:w-60">
                  <Select
                    value=""
                    label="Ajouter une épargne"
                    className="h-9 border-dashed text-sm text-stone-500"
                    onChange={(accountId) =>
                      accountId && saveRates([...savingsRates, { accountId, rate: 0.1 }])
                    }
                    options={[
                      { value: '', label: '+ Ajouter une épargne' },
                      ...savingsAccounts.map((account) => ({ value: account.id, label: account.name })),
                    ]}
                  />
                </div>
              )}
              {entry.savingsRates === null && savingsRates.length > 0 && (
                <p className="mt-2 text-xs text-stone-400">
                  Taux repris du mois précédent. Une modification ne vaut qu’à partir de ce mois.
                </p>
              )}
              {summary.savingsTotal > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50/60 px-3 py-2.5 dark:bg-emerald-500/5">
                  {entry.savingsTransfer ? (
                    <>
                      <span className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                        <Check className="h-4 w-4" aria-hidden />
                        {payer
                          ? `Épargne versée par ${memberLabel(dataset, payer)} le ${formatDateFr(entry.savingsTransfer.date)}`
                          : `Épargne virée le ${formatDateFr(entry.savingsTransfer.date)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void report(finance.cancelSavingsTransfer(month), 'Virement d’épargne annulé')
                        }
                        className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline dark:hover:text-stone-200"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-stone-600 dark:text-stone-300">
                        {payer
                          ? `À verser par ${memberLabel(dataset, payer)} sur les livrets :`
                          : 'À virer en fin de mois :'}{' '}
                        <Amount cents={summary.savingsTotal} className="font-medium" />
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void report(
                            finance.transferSavings(month),
                            payer
                              ? 'Versements ajoutés aux livrets'
                              : 'Virement d’épargne ajouté au compte commun',
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-xs ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50 dark:bg-stone-900 dark:text-emerald-300 dark:ring-emerald-500/30"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {payer ? 'Épargne versée' : 'Virement fait'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </Indented>
          </div>
        </div>

        <aside className="border-t border-stone-100 bg-stone-50/70 px-5 py-6 dark:border-stone-800 dark:bg-stone-900/40 sm:px-6 lg:rounded-br-2xl lg:border-l lg:border-t-0">
          <Heading icon={ReceiptText} tone="stone" title="Récapitulatif" />
          <div className="mt-4">
            {members.map((member, index) =>
              member.salaryOnCommon ? (
                <RecapLine
                  key={member.id}
                  label={`Revenus ${memberLabel(dataset, member.id)}`}
                  detail={shareOf(member.id)}
                  amount={summary.incomes[member.id] ?? 0}
                  dot={MEMBER_DOTS[index % MEMBER_DOTS.length]}
                />
              ) : (
                <RecapLine
                  key={member.id}
                  label={`Revenus ${memberLabel(dataset, member.id)}`}
                  detail={shareOf(member.id) ?? 'Versés sur son compte : à saisir'}
                  amount={summary.incomes[member.id] ?? 0}
                  dot={MEMBER_DOTS[index % MEMBER_DOTS.length]}
                  input={
                    <MoneyInput
                      key={`${month}-${member.id}-${summary.incomes[member.id] ?? 0}`}
                      cents={summary.incomes[member.id] ?? 0}
                      label={`Revenus ${memberLabel(dataset, member.id)} du mois`}
                      className="w-28"
                      onCommit={(cents) =>
                        save({ outsideIncomes: { ...entry.outsideIncomes, [member.id]: cents } })
                      }
                    />
                  }
                />
              ),
            )}
            <Divider />
            <RecapLine label="Enveloppe commune" amount={summary.envelope} strong />
            <RecapLine label="Report du mois précédent" amount={summary.carriedOver} sign="+" />
            <RecapLine label="Autres entrées" amount={summary.inflows} sign="+" />
            <RecapLine label="Épargne" amount={summary.savingsTotal} sign="−" />
            <Divider />
            <RecapLine label="Disponible" amount={summary.available} strong />
            <RecapLine label="Dépenses du mois" amount={summary.expenses} sign="−" />
          </div>
          <div
            className={cx(
              'mt-4 flex items-baseline justify-between rounded-xl px-4 py-3',
              positive
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
            )}
          >
            <span className="text-sm font-medium">Reste du mois</span>
            <Amount cents={summary.balance} className="text-base font-semibold" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            Salaire versé sur le commun : opérations de type Revenu. Salaire versé ailleurs : saisi ici,
            repris le mois suivant. Le reste est reporté sur le mois suivant, à l’euro près.
          </p>
        </aside>
      </div>
    </section>
  );
};

export default CommonMonthCard;
