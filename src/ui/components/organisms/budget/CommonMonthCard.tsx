import { Check, PiggyBank, ReceiptText, RotateCcw, Wallet, X, type LucideIcon } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { savingsLineName, savingsRename } from '@/core/commun/savingsRates';
import { formatDateFr, formatEuros, formatRate, rateInput } from '@/core/shared/format';
import { parsePercent } from '@/core/shared/money';
import type { Cents, MonthKey } from '@/core/shared/model';
import { useCommonMonth } from '@/hooks/commun/useCommonMonth';
import Amount from '@/ui/components/atoms/Amount';
import { cx } from '@/ui/design-system/cx';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import MoneyInput from '@/ui/components/molecules/form/MoneyInput';
import Text from '@/ui/components/atoms/Text';
import Title from '@/ui/components/atoms/Title';
import { MEMBER_COLORS, NEUTRAL_MARK } from '@/ui/design-system/tokens';

type RatePercentProps = { rate: number; onCommit: (rate: number) => void; label: string };

/** Pourcentage saisi en clair (« 10 » ou « 12,5 »), validé à la sortie du champ. */
const RatePercent = ({ rate, onCommit, label }: RatePercentProps) => {
  const initial = rateInput(rate);
  const [text, setText] = useState(initial);
  const commit = () => {
    const parsed = parsePercent(text);
    if (!parsed.ok) {
      setText(initial);
      return;
    }
    // Champ vidé : 0 %, comme avant.
    const value = parsed.value ?? 0;
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
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
        %
      </span>
    </span>
  );
};

type SavingsNameProps = { name: string; accountName?: string; onRename: (label: string) => void };

/** Nom de l'enveloppe d'épargne, modifiable d'un clic ; le compte apparaît dessous s'il diffère. */
const SavingsName = ({ name, accountName, onRename }: SavingsNameProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  // Échap ferme le champ sans enregistrer : le blur qui peut suivre doit ignorer la saisie.
  const cancelled = useRef(false);
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
            const next = savingsRename(name, draft, accountName, { cancelled: cancelled.current });
            cancelled.current = false;
            if (next.kind === 'save') {
              onRename(next.label);
            }
            setDraft(null);
          }}
          onKeyDown={(key) => {
            if (key === 'Enter') {
              (document.activeElement as HTMLElement | null)?.blur();
            }
            if (key === 'Escape') {
              cancelled.current = true;
              setDraft(null);
            }
          }}
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        cancelled.current = false;
        setDraft(name);
      }}
      title="Renommer"
      className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-muted"
    >
      <Text as="span" className="block">
        {name}
      </Text>
      {accountName && accountName !== name && (
        <Text variant="small" as="span" className="block">
          sur {accountName}
        </Text>
      )}
    </button>
  );
};

type Tone = 'brand' | 'emerald' | 'stone';

const TONES: Record<Tone, string> = {
  brand: 'bg-accent-soft text-accent-ink',
  emerald: 'bg-positive-soft text-positive-ink',
  stone: 'bg-surface-muted text-ink-subtle-strong',
};

type HeadingProps = { icon: LucideIcon; tone: Tone; title: string; hint?: string };

/** Titre de bloc : pastille d'icône teintée, titre et aide alignés sur la même colonne. */
const Heading = ({ icon: Icon, tone, title, hint }: HeadingProps) => (
  <div className="flex items-start gap-3">
    <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONES[tone])}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
    <div className="min-w-0 pt-1">
      <Title level={3}>{title}</Title>
      {hint && (
        <Text variant="small" className="mt-0.5 leading-relaxed">
          {hint}
        </Text>
      )}
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
      <Text variant="small" as="span" className="flex w-3 shrink-0 justify-center">
        {dot ? <span className="h-2 w-2 -translate-y-px rounded-full" style={{ background: dot }} /> : sign}
      </Text>
      <span>
        <span className={cx('text-sm', strong ? 'font-semibold text-ink-strong' : 'text-ink-secondary')}>
          {label}
        </span>
        {detail && (
          <Text variant="small" as="span" className="block">
            {detail}
          </Text>
        )}
      </span>
    </div>
    {input ?? (
      <Amount
        cents={amount}
        className={cx('text-sm', strong ? 'font-semibold text-ink-strong' : 'text-ink-body')}
      />
    )}
  </div>
);

const Divider = () => <div className="my-2 border-t border-line-faint" />;

/** Le mois du compte commun : enveloppe et épargne à gauche, récapitulatif du calcul à droite. */
const CommonMonthCard = ({ month }: { month: MonthKey }) => {
  const common = useCommonMonth(month);
  const { entry, summary, members, savingsRates, savingsAccounts, payerName, nameOf, accountOf } = common;
  const rate = common.contributionRate;
  const shareOf = (memberId: string): string | undefined => {
    const share = common.shareOf(memberId);
    return share === null
      ? undefined
      : `${formatRate(share)} · part ${formatEuros(summary.contributions[memberId] ?? 0)}`;
  };
  const positive = summary.balance >= 0;

  return (
    <section className="rounded-2xl border border-line-card bg-surface shadow-card dark:shadow-none">
      <header className="border-b border-line px-5 py-4 sm:px-6">
        <Title level={2}>Le mois du commun</Title>
        <Text variant="small" className="mt-0.5">
          Enveloppe, épargne et reste du mois
        </Text>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col divide-y divide-line px-5 sm:px-6">
          <div className="py-6">
            <Heading
              icon={Wallet}
              tone="brand"
              title="Enveloppe commune"
              hint={`${formatRate(rate)} des revenus du mois (${formatEuros(summary.totalIncome)}), arrondi aux 50 € supérieurs.`}
            />
            <Indented>
              <div className="flex flex-wrap items-center gap-3">
                <MoneyInput
                  key={`${month}-${summary.envelope}`}
                  cents={summary.envelope}
                  label="Enveloppe du mois"
                  className="w-36"
                  onCommit={common.setEnvelope}
                />
                {entry.envelope === null ? (
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-ink-medium">
                    Montant proposé
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={common.resetEnvelope}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-ink-subtle-fixed transition-colors hover:bg-surface-muted hover:text-ink-emphasis"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    Revenir à {formatEuros(summary.suggestedEnvelope)}
                  </button>
                )}
              </div>
              {summary.totalIncome === 0 && (
                <Text variant="small" className="mt-2">
                  Aucun revenu ce mois-ci : un salaire versé sur le commun vient des opérations (type Revenu,
                  « De qui ») ; un salaire versé ailleurs se saisit dans le récapitulatif.
                </Text>
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
                  const name = savingsLineName(line, account);
                  return (
                    <li key={`${line.accountId}-${index}`} className="group flex items-center gap-3 py-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: account?.color ?? NEUTRAL_MARK }}
                        aria-hidden
                      />
                      <SavingsName
                        key={`${month}-${index}-${name}`}
                        name={name}
                        accountName={account?.name}
                        onRename={(label) => common.renameRate(index, label)}
                      />
                      <RatePercent
                        key={`${month}-${line.accountId}-${line.rate}`}
                        rate={line.rate}
                        label={`Pourcentage pour ${name}`}
                        onCommit={(next) => common.setRate(index, next)}
                      />
                      <Amount cents={line.amount} className="w-24 text-right text-sm text-ink-body" />
                      <button
                        type="button"
                        aria-label={`Retirer ${name}`}
                        onClick={() => common.removeRate(index)}
                        className="rounded-md p-1 text-ink-ghost-fixed opacity-0 transition hover:bg-surface-muted hover:text-ink-secondary-fixed focus:opacity-100 group-hover:opacity-100"
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
                    className="h-9 border-dashed text-sm text-ink-prompt"
                    onChange={(accountId) => accountId && common.addRate(accountId)}
                    options={[
                      { value: '', label: '+ Ajouter une épargne' },
                      ...savingsAccounts.map((account) => ({ value: account.id, label: account.name })),
                    ]}
                  />
                </div>
              )}
              {entry.savingsRates === null && savingsRates.length > 0 && (
                <Text variant="small" className="mt-2">
                  Taux repris du mois précédent. Une modification ne vaut qu’à partir de ce mois.
                </Text>
              )}
              {summary.savingsTotal > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-positive-soft-faint px-3 py-2.5">
                  {entry.savingsTransfer ? (
                    <>
                      <span className="flex items-center gap-2 text-sm text-positive-ink-deep">
                        <Check className="h-4 w-4" aria-hidden />
                        {payerName
                          ? `Épargne versée par ${payerName} le ${formatDateFr(entry.savingsTransfer.date)}`
                          : `Épargne virée le ${formatDateFr(entry.savingsTransfer.date)}`}
                      </span>
                      <button
                        type="button"
                        onClick={common.cancelSavingsTransfer}
                        className="text-xs text-ink-subtle-fixed underline-offset-2 hover:text-ink-emphasis-soft hover:underline"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-ink-secondary">
                        {payerName
                          ? `À verser par ${payerName} sur les livrets :`
                          : 'À virer en fin de mois :'}{' '}
                        <Amount cents={summary.savingsTotal} className="font-medium" />
                      </span>
                      <button
                        type="button"
                        onClick={common.transferSavings}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-field px-3 py-1.5 text-xs font-medium text-positive-ink-strong shadow-xs ring-1 ring-positive-line-soft transition-colors hover:bg-positive-soft-fixed"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {payerName ? 'Épargne versée' : 'Virement fait'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </Indented>
          </div>
        </div>

        <aside className="border-t border-line bg-surface-row px-5 py-6 sm:px-6 lg:rounded-br-2xl lg:border-l lg:border-t-0">
          <Heading icon={ReceiptText} tone="stone" title="Récapitulatif" />
          <div className="mt-4">
            {members.map((member, index) =>
              member.salaryOnCommon ? (
                <RecapLine
                  key={member.id}
                  label={`Revenus ${nameOf(member.id)}`}
                  detail={shareOf(member.id)}
                  amount={summary.incomes[member.id] ?? 0}
                  dot={MEMBER_COLORS[index % MEMBER_COLORS.length]}
                />
              ) : (
                <RecapLine
                  key={member.id}
                  label={`Revenus ${nameOf(member.id)}`}
                  detail={shareOf(member.id) ?? 'Versés sur son compte : à saisir'}
                  amount={summary.incomes[member.id] ?? 0}
                  dot={MEMBER_COLORS[index % MEMBER_COLORS.length]}
                  input={
                    <MoneyInput
                      key={`${month}-${member.id}-${summary.incomes[member.id] ?? 0}`}
                      cents={summary.incomes[member.id] ?? 0}
                      label={`Revenus ${nameOf(member.id)} du mois`}
                      className="w-28"
                      onCommit={(cents) => common.setOutsideIncome(member.id, cents)}
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
                ? 'bg-positive-soft text-positive-ink-deep'
                : 'bg-warning-soft text-warning-ink-deeper',
            )}
          >
            <span className="text-sm font-medium">Reste du mois</span>
            <Amount cents={summary.balance} className="text-base font-semibold" />
          </div>
          <Text variant="small" className="mt-3 leading-relaxed">
            Salaire versé sur le commun : opérations de type Revenu. Salaire versé ailleurs : saisi ici,
            repris le mois suivant. Le reste est reporté sur le mois suivant, à l’euro près.
          </Text>
        </aside>
      </div>
    </section>
  );
};

export default CommonMonthCard;
