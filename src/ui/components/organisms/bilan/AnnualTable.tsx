import { pivotByGroup, visibleMonthIndex, type YearSummary } from '@/core/budget/annual';
import { monthsOfYear } from '@/core/shared/dates';
import { monthShortLabel } from '@/core/shared/format';
import type { IsoDate, WorkspaceKind } from '@/core/shared/model';
import { groupLabel } from '@/ui/constants';
import Amount from '@/ui/components/atoms/Amount';
import Card from '@/ui/components/molecules/cards/Card';

const MONTH_COLUMN_WIDTH = 72;

/** Fait défiler le tableau (une seule fois) pour que le mois donné soit visible à droite. */
const scrollToMonth = (monthIndex: number) => (node: HTMLDivElement | null) => {
  if (!node || node.dataset.scrolled === '1') {
    return;
  }
  node.dataset.scrolled = '1';
  window.requestAnimationFrame(() => {
    const header = node.querySelectorAll('thead th')[monthIndex + 1];
    const target = header instanceof HTMLElement ? header.offsetLeft + header.offsetWidth : 0;
    node.scrollLeft = Math.max(0, target - node.clientWidth + MONTH_COLUMN_WIDTH);
  });
};

type AnnualTableProps = { summary: YearSummary; year: number; today: IsoDate; kind: WorkspaceKind };

/** Catégories en lignes, mois en colonnes, avec le total des dépenses. */
const AnnualTable = ({ summary, year, today, kind }: AnnualTableProps) => (
  <Card title="Tableau annuel" subtitle="Catégories en lignes, mois en colonnes" padded={false}>
    <div key={year} className="overflow-x-auto" ref={scrollToMonth(visibleMonthIndex(year, today))}>
      <table className="table-base min-w-[1100px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface">Catégorie</th>
            {monthsOfYear(year).map((key) => (
              <th key={key} className="text-right capitalize">
                {monthShortLabel(key)}
              </th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {pivotByGroup(summary.pivot).map(({ group, rows }) => [
            <tr key={`${group}-title`}>
              <td colSpan={14} className="bg-surface-sunken font-semibold text-ink-secondary">
                <span className="sticky left-3">{groupLabel(group, kind)}</span>
              </td>
            </tr>,
            ...rows.map((row) => (
              <tr key={row.categoryId}>
                <td className="sticky left-0 bg-surface font-medium">{row.name}</td>
                {row.months.map((value, index) => (
                  <td key={index} className="text-right tabular-nums">
                    {value === 0 ? (
                      <span className="text-ink-ghost">·</span>
                    ) : (
                      <Amount cents={value} rounded />
                    )}
                  </td>
                ))}
                <td className="text-right font-semibold">
                  <Amount cents={row.total} rounded />
                </td>
              </tr>
            )),
          ])}
          <tr>
            <td className="sticky left-0 bg-surface font-semibold">Total dépenses</td>
            {summary.months.map((entry) => (
              <td key={entry.month} className="text-right font-semibold">
                <Amount cents={entry.totals.depenses} rounded />
              </td>
            ))}
            <td className="text-right font-semibold">
              <Amount cents={summary.totals.depenses} rounded />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
);

export default AnnualTable;
