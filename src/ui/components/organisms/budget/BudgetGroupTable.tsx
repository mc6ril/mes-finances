import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { groupLabel } from '@/ui/constants';
import { groupTotal, hasSpendingLimit, type BudgetLine } from '@/core/budget/budget';
import type { CategoryGroup, Cents } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Card from '@/ui/components/molecules/cards/Card';
import MoneyInput from '@/ui/components/molecules/form/MoneyInput';
import ProgressBar, { type ProgressTone } from '@/ui/components/atoms/ProgressBar';
import Text from '@/ui/components/atoms/Text';
import { STATUS_BADGE, STATUS_TONE } from './budgetStatus';

const progressTone = (line: BudgetLine): ProgressTone =>
  hasSpendingLimit(line.group) ? STATUS_TONE[line.status] : 'brand';

type LineProps = { line: BudgetLine };

const Gap = ({ line }: LineProps) => {
  if (line.available === 0 && line.actual === 0) {
    return (
      <Text as="span" variant="caption">
        —
      </Text>
    );
  }
  return <Amount cents={line.gap} signed colored />;
};

const Trend = ({ line }: LineProps) => {
  if (line.previousActual === 0 && line.actual === 0) {
    return (
      <Text as="span" variant="caption">
        —
      </Text>
    );
  }
  return <Amount cents={line.actual - line.previousActual} signed className="text-xs text-ink-muted" />;
};

type BudgetGroupTableProps = { group: CategoryGroup; lines: BudgetLine[]; month: string };

/** Lignes d'un groupe du budget : montant prévu modifiable, réel, écart et progression. */
const BudgetGroupTable = ({ group, lines, month }: BudgetGroupTableProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const { settings } = useDataset();
  const rows = lines.filter((line) => line.group === group);
  // Groupe vide (ex. épargne sans compte suivi) : rien à afficher.
  if (rows.length === 0) {
    return null;
  }
  const planned = groupTotal(rows, group, 'available');
  const actual = groupTotal(rows, group, 'actual');
  return (
    <Card
      title={groupLabel(group, settings.kind)}
      padded={false}
      action={
        <Text variant="small">
          Réel <Amount cents={actual} className="font-semibold text-ink-strong" /> / prévu{' '}
          <Amount cents={planned} />
        </Text>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-base min-w-[640px]">
          <thead>
            <tr>
              <th className="w-[34%]">Catégorie</th>
              <th className="w-32 text-right">Budget prévu</th>
              <th className="text-right">Réel</th>
              <th className="text-right">Écart</th>
              <th className="w-40">Progression</th>
              <th className="text-right">vs mois préc.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => {
              const badge = hasSpendingLimit(line.group) ? STATUS_BADGE[line.status] : null;
              return (
                <tr key={line.categoryId}>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Text as="span" className="font-medium">
                        {line.name}
                      </Text>
                      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                    </div>
                    {line.carriedOver > 0 && (
                      <Text variant="caption">
                        dont report <Amount cents={line.carriedOver} />
                      </Text>
                    )}
                  </td>
                  <td>
                    <MoneyInput
                      key={`${month}-${line.categoryId}-${line.planned}`}
                      cents={line.planned}
                      label={`Budget prévu ${line.name}`}
                      onCommit={(cents: Cents) =>
                        void report(finance.setBudgetLine(month, line.categoryId, cents, line.name))
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
                    <Gap line={line} />
                  </td>
                  <td>
                    <ProgressBar
                      value={line.progress}
                      tone={progressTone(line)}
                      label={`Progression ${line.name}`}
                    />
                  </td>
                  <td className="text-right">
                    <Trend line={line} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default BudgetGroupTable;
