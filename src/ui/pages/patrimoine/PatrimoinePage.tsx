import { ArchiveRestore, ChevronRight, Landmark, Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { patrimoineContext, referenceDate } from '@/core/budget/overview';
import { useChartTheme } from '@/hooks/useTheme';
import { useReport } from '@/hooks/useReport';
import { ACCOUNT_GROUP_LABELS, ACCOUNT_KIND_LABELS } from '@/ui/constants';
import { lastMonths, monthEnd, parseMonthKey, toMonthKey } from '@/core/shared/dates';
import { capitalize, formatDateFr, formatPercent, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Account, MonthKey } from '@/core/shared/model';
import {
  monthsSinceTracking,
  patrimoineAt,
  patrimoineSeries,
  personalValueOf,
  type AccountPosition,
} from '@/core/patrimoine/patrimoine';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Field, Input } from '@/ui/design-system/Field';
import Segmented from '@/ui/design-system/Segmented';
import StatCard from '@/ui/design-system/StatCard';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/charts/axis';
import Legend from '@/ui/charts/Legend';
import PageHeader from '@/ui/layout/PageHeader';
import AccountModal from './AccountModal';
import SavingsAccountForm from './SavingsAccountForm';
import EmptyState from '@/ui/design-system/EmptyState';
import { isSavingsAccount } from '@/core/comptes/accounts';

type Range = '1' | '3' | '6' | '12' | 'annee';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '1', label: '1 mois' },
  { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' },
  { value: '12', label: '12 mois' },
  { value: 'annee', label: 'Année' },
];

const monthsFor = (range: Range, month: MonthKey): MonthKey[] => {
  if (range === 'annee') {
    const { year, month: current } = parseMonthKey(month);
    return Array.from({ length: current }, (_, index) => toMonthKey(year, index + 1));
  }
  return lastMonths(month, Number(range) + 1);
};

type AccountCardProps = { account: Account; position: AccountPosition; color: string; onOpen: () => void };

const AccountCard = ({ account, position, color, onOpen }: AccountCardProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="group flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 text-left shadow-card transition hover:border-brand-300 dark:border-stone-800 dark:bg-[#1c1c1b] dark:hover:border-brand-500/50"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
        <Text variant="strong">{account.name}</Text>
      </div>
      <ChevronRight
        className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"
        aria-hidden
      />
    </div>
    <div className="text-xl font-semibold tracking-tight">
      <Amount cents={position.value} />
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <dt className="text-stone-500 dark:text-stone-400">Versé net</dt>
      <dd className="text-right tabular-nums">
        <Amount cents={position.contributions} />
      </dd>
      <dt className="text-stone-500 dark:text-stone-400">Intérêts</dt>
      <dd className="text-right">
        <Amount cents={position.interests} />
      </dd>
      <dt className="text-stone-500 dark:text-stone-400">Frais</dt>
      <dd className="text-right">
        <Amount cents={-position.fees} />
      </dd>
      <dt className="text-stone-500 dark:text-stone-400">Plus/moins-value</dt>
      <dd className="text-right">
        <Amount cents={position.marketGain} signed colored />
      </dd>
    </dl>
    <div className="flex flex-wrap gap-1.5">
      <Badge>{ACCOUNT_KIND_LABELS[account.kind]}</Badge>
      {position.valuationDate && (
        <Badge tone="info">Valorisé le {formatDateFr(position.valuationDate)}</Badge>
      )}
    </div>
  </button>
);

type JointCardProps = { account: Account; position: AccountPosition };

const JointCard = ({ account, position }: JointCardProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [share, setShare] = useState(
    account.personalSharePercent === null ? '' : String(account.personalSharePercent),
  );
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (share.trim() === '') {
      setError(null);
      void report(finance.saveAccount({ ...account, personalSharePercent: null }), 'Compte enregistré');
      return;
    }
    const value = Number(share.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError('Entre 0 et 100 %');
      return;
    }
    setError(null);
    void report(finance.saveAccount({ ...account, personalSharePercent: value }), 'Compte enregistré');
  };
  const personal = personalValueOf(account, position.value);
  return (
    <Card
      title={account.name}
      subtitle="Compte commun : affiché à part de ton patrimoine personnel"
      action={<Users className="h-4 w-4 text-stone-400" aria-hidden />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Text variant="label">Solde total du compte</Text>
          <div className="mt-1 text-xl font-semibold">
            <Amount cents={position.value} />
          </div>
          <Text variant="caption">Montant provisoire, à confirmer</Text>
        </div>
        <Field label="Ta quote-part (%)" error={error} hint="Laisse vide tant qu’elle n’est pas définie">
          <Input
            value={share}
            onChange={setShare}
            onBlur={commit}
            inputMode="decimal"
            placeholder="Non renseignée"
          />
        </Field>
        <div>
          <Text variant="label">Ta part</Text>
          <div className="mt-1 text-xl font-semibold">
            {personal === null ? (
              <Text as="span" variant="muted">
                Non comptée
              </Text>
            ) : (
              <Amount cents={personal} />
            )}
          </div>
          <Text variant="caption">
            {personal === null ? 'Exclue du patrimoine personnel' : 'Incluse dans le patrimoine personnel'}
          </Text>
        </div>
      </div>
    </Card>
  );
};

const PatrimoinePage = () => {
  const dataset = useDataset();
  const { currentMonth: month, today } = usePeriod();
  const { series, ink } = useChartTheme();
  const [range, setRange] = useState<Range>('12');
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const [editedAccount, setEditedAccount] = useState<Account | 'new' | null>(null);
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const date = referenceDate(month, today);
  const snapshot = useMemo(
    () => patrimoineAt(dataset.accounts, context, date),
    [dataset.accounts, context, date],
  );
  const months = useMemo(
    () => monthsSinceTracking(dataset.accounts, monthsFor(range, month)),
    [dataset.accounts, range, month],
  );
  const evolution = useMemo(
    () =>
      patrimoineSeries(dataset.accounts, context, months, today).map((point) => ({
        month: point.month,
        patrimoine: point.personalTotal,
        verse: point.contributions,
        gains: point.personalTotal - point.contributions,
      })),
    [dataset.accounts, context, months, today],
  );
  const active = dataset.accounts.filter((account) => !account.archived);
  const savingsAccounts = active.filter((account) => isSavingsAccount(account) && !account.isJoint);
  const archivedSavings = dataset.accounts.filter((account) => account.archived && isSavingsAccount(account));
  const jointAccounts = active.filter((account) => account.isJoint);
  const positionOf = (account: Account) =>
    snapshot.positions.find((position) => position.accountId === account.id);
  const colorOf = (account: Account) => series[active.indexOf(account) % series.length] ?? series[0] ?? '';
  const performance = snapshot.personalTotal - snapshot.contributions;
  const allocation = (['courant', 'securise', 'investissement'] as const)
    .map((group, index) => ({
      id: group,
      name: ACCOUNT_GROUP_LABELS[group],
      value: snapshot.byGroup[group],
      color: series[index] ?? '',
    }))
    .filter((entry) => entry.value > 0);
  const comparison = savingsAccounts.map((account) => ({
    name: account.name,
    value: positionOf(account)?.value ?? 0,
    gain: positionOf(account)?.performance ?? 0,
    color: colorOf(account),
  }));
  const first = evolution[0];
  const last = evolution[evolution.length - 1];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Épargne et patrimoine"
        description={`Situation au ${formatDateFr(date)} · ${capitalize(monthLabel(month))}`}
        actions={
          <Button icon={Plus} variant="primary" onClick={() => setEditedAccount('new')}>
            Ajouter un compte
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Patrimoine personnel"
          icon={Landmark}
          value={<Amount cents={snapshot.personalTotal} rounded />}
          hint={snapshot.joint.shareMissing ? 'Hors compte commun' : 'Quote-part commune incluse'}
        />
        <StatCard
          label="Gains et pertes constatés"
          icon={Landmark}
          value={<Amount cents={performance} signed colored rounded />}
          hint="Intérêts + plus-values − frais"
          accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
        />
        <StatCard
          label={`Évolution sur la période`}
          icon={Landmark}
          value={<Amount cents={(last?.patrimoine ?? 0) - (first?.patrimoine ?? 0)} signed colored rounded />}
          hint={
            <>
              dont argent ajouté ou retiré{' '}
              <Amount cents={(last?.verse ?? 0) - (first?.verse ?? 0)} signed rounded />
            </>
          }
          accent="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
        />
      </div>

      <Card
        title="Évolution du patrimoine personnel"
        subtitle="Fin de chaque mois : la valeur totale comparée aux sommes versées"
        action={<Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} label="Période" />}
      >
        <Legend
          items={[
            { label: 'Valeur totale', color: series[0] ?? '' },
            { label: 'Sommes versées cumulées', color: series[1] ?? '', dashed: true },
          ]}
        />
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={evolution} margin={{ left: 4, right: 8, top: 4 }}>
              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis
                dataKey="month"
                {...axisProps(ink)}
                tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
              />
              <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={70} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
              <Line
                type="monotone"
                dataKey="patrimoine"
                name="Valeur totale"
                stroke={series[0]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="verse"
                name="Sommes versées"
                stroke={series[1]}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Text variant="caption" className="mt-2">
          L’écart entre les deux courbes correspond à la performance réelle (intérêts, plus-values, frais) :
          la croissance due aux versements n’est pas de la performance.
        </Text>
      </Card>

      <div>
        <Text variant="label" className="mb-3">
          Mes comptes d’épargne et placements
        </Text>
        {savingsAccounts.length === 0 && jointAccounts.length === 0 && (
          <EmptyState
            icon={Landmark}
            title="Aucun compte d’épargne suivi"
            description="Ajoute un livret, une assurance-vie ou un compte-titres : il apparaîtra ici et dans ton budget. Les virements depuis ton compte courant compteront comme versements."
            action={
              <Button icon={Plus} variant="primary" onClick={() => setEditedAccount('new')}>
                Ajouter un compte
              </Button>
            }
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {savingsAccounts.map((account) => {
            const position = positionOf(account);
            if (!position) {
              return null;
            }
            return (
              <AccountCard
                key={account.id}
                account={account}
                position={position}
                color={colorOf(account)}
                onOpen={() => setOpenAccount(account)}
              />
            );
          })}
        </div>
      </div>

      {jointAccounts.map((account) => {
        const position = positionOf(account);
        if (!position) {
          return null;
        }
        return (
          <div key={account.id} className="flex flex-col gap-2">
            <JointCard
              key={`${account.id}-${account.personalSharePercent}`}
              account={account}
              position={position}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setOpenAccount(account)}>
                Historique et mouvements
              </Button>
            </div>
          </div>
        );
      })}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Répartition" subtitle="Courant, épargne sécurisée et investissements (hors commun)">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={1.5}
                    stroke={ink.surface}
                    strokeWidth={2}
                  >
                    {allocation.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex w-full flex-col gap-2">
              {allocation.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: entry.color }}
                      aria-hidden
                    />
                    <Text as="span">{entry.name}</Text>
                  </span>
                  <span className="flex items-center gap-2">
                    <Text as="span" variant="small" className="whitespace-nowrap">
                      {formatPercent(
                        Math.round(
                          (entry.value /
                            Math.max(
                              1,
                              snapshot.byGroup.courant +
                                snapshot.byGroup.securise +
                                snapshot.byGroup.investissement,
                            )) *
                            100,
                        ),
                      )}
                    </Text>
                    <Amount cents={entry.value} rounded />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card title="Comparaison des comptes" subtitle="Valeur actuelle de chaque placement">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart
                data={comparison}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
                barCategoryGap={8}
              >
                <CartesianGrid stroke={ink.grid} horizontal={false} />
                <XAxis type="number" {...axisProps(ink)} tickFormatter={euroTick} />
                <YAxis type="category" dataKey="name" {...axisProps(ink)} width={110} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: ink.grid, opacity: 0.4 }} />
                <Bar dataKey="value" name="Valeur" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {comparison.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Gains et pertes par placement" subtitle="Performance constatée : valeur − sommes versées">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={comparison} margin={{ left: 4, right: 8 }}>
              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps(ink)} />
              <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: ink.grid, opacity: 0.4 }} />
              <Bar dataKey="gain" name="Gains / pertes" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {comparison.map((entry) => (
                  <Cell key={entry.name} fill={entry.gain >= 0 ? '#1baf7a' : '#e34948'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {archivedSavings.length > 0 && (
        <Card title="Comptes archivés" subtitle="Ils restent dans l’historique mais ne sont plus suivis">
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {archivedSavings.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-2">
                <Text>{account.name}</Text>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ArchiveRestore}
                  onClick={() => setEditedAccount(account)}
                >
                  Gérer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editedAccount && (
        <SavingsAccountForm
          account={editedAccount === 'new' ? undefined : editedAccount}
          onClose={() => setEditedAccount(null)}
        />
      )}

      {openAccount && (
        <AccountModal
          account={openAccount}
          onClose={() => setOpenAccount(null)}
          months={lastMonths(month, 12)}
          endDate={monthEnd(month)}
        />
      )}
    </div>
  );
};

export default PatrimoinePage;
