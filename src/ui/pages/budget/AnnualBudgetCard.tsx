import { CalendarClock } from 'lucide-react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { yearBudgetOf, yearBudgetOriginOf } from '@/core/budget/overview';
import { useReport } from '@/hooks/useReport';
import { annualLines, type AnnualLine, type LineStatus } from '@/core/budget/budget';
import type { Cents, WorkspaceKind } from '@/core/shared/model';
import { groupLabel } from '@/ui/constants';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Card from '@/ui/design-system/Card';
import EmptyState from '@/ui/design-system/EmptyState';
import MoneyInput from '@/ui/design-system/MoneyInput';
import ProgressBar, { type ProgressTone } from '@/ui/design-system/ProgressBar';
import Text from '@/ui/design-system/Text';

const STATUS_TONE: Record<LineStatus, ProgressTone> = {
  ok: 'good',
  attention: 'warning',
  depasse: 'critical',
};
const STATUS_BADGE: Record<LineStatus, { tone: 'good' | 'warning' | 'critical'; label: string } | null> = {
  ok: null,
  attention: { tone: 'warning', label: 'Presque atteint' },
  depasse: { tone: 'critical', label: 'Dépassé' },
};

type RemainingProps = { line: AnnualLine };

const Remaining = ({ line }: RemainingProps) => {
  if (line.planned === 0 && line.actual === 0) {
    return (
      <Text as="span" variant="caption">
        —
      </Text>
    );
  }
  return <Amount cents={line.remaining} signed colored />;
};

const annualSubtitle = (origin: string | null, kind: WorkspaceKind): string => {
  const base = `Dépenses ponctuelles suivies sur l’année, hors du budget mensuel des ${groupLabel('plaisir', kind).toLowerCase()}`;
  if (origin) {
    return `${base} · montants repris de ${origin}, modifiables pour cette année`;
  }
  return base;
};

type AnnualBudgetCardProps = { year: number };

const AnnualBudgetCard = ({ year }: AnnualBudgetCardProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const yearKey = String(year);
  const lines = annualLines({
    yearBudget: yearBudgetOf(dataset, yearKey),
    categories: dataset.categories,
    transactions: dataset.transactions,
    year,
  });
  const planned = lines.reduce((total, line) => total + line.planned, 0);
  const actual = lines.reduce((total, line) => total + line.actual, 0);
  return (
    <Card
      title={`Budgets annuels ${year}`}
      subtitle={annualSubtitle(yearBudgetOriginOf(dataset, yearKey), dataset.settings.kind)}
      padded={false}
      action={
        <Text variant="small">
          Dépensé <Amount cents={actual} className="font-semibold text-stone-900 dark:text-stone-50" /> /
          prévu <Amount cents={planned} />
        </Text>
      }
    >
      {lines.length === 0 ? (
        <div className="px-4 pb-5 sm:px-5">
          <EmptyState
            icon={CalendarClock}
            title="Aucune catégorie annuelle"
            description="Dans Paramètres → Catégories et règles, passe une catégorie en « Annuel » pour la suivre sur l’année."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base min-w-[640px]">
            <thead>
              <tr>
                <th className="w-[30%]">Catégorie</th>
                <th className="w-32 text-right">Budget de l’année</th>
                <th className="text-right">Dépensé</th>
                <th className="text-right">Reste</th>
                <th className="w-40">Progression</th>
                <th className="text-right">Provision / mois</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.categoryId}>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Text as="span" className="font-medium">
                        {line.name}
                      </Text>
                      {STATUS_BADGE[line.status] && (
                        <Badge tone={STATUS_BADGE[line.status]?.tone}>
                          {STATUS_BADGE[line.status]?.label}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td>
                    <MoneyInput
                      key={`${yearKey}-${line.categoryId}-${line.planned}`}
                      cents={line.planned}
                      label={`Budget annuel ${line.name}`}
                      onCommit={(cents: Cents) =>
                        void report(finance.setYearBudgetLine(yearKey, line.categoryId, cents, line.name))
                      }
                      className="ml-auto w-28"
                    />
                  </td>
                  <td className="text-right">
                    <Amount cents={line.actual} />
                    {line.upcoming > 0 && (
                      <Text variant="caption">
                        + <Amount cents={line.upcoming} /> prévu
                      </Text>
                    )}
                  </td>
                  <td className="text-right">
                    <Remaining line={line} />
                  </td>
                  <td>
                    <ProgressBar
                      value={line.progress}
                      tone={STATUS_TONE[line.status]}
                      label={`Progression ${line.name}`}
                    />
                  </td>
                  <td className="text-right">
                    <Amount
                      cents={line.monthlyProvision}
                      className="text-xs text-stone-500 dark:text-stone-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default AnnualBudgetCard;
