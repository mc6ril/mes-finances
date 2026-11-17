import { useState } from 'react';
import { parseMonthKey } from '@/core/shared/dates';
import { capitalize, monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import { useBudgetMonth } from '@/hooks/budget/useBudgetMonth';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import PageHeader from '@/ui/components/molecules/PageHeader';
import AnnualBudgetCard from '@/ui/components/organisms/budget/AnnualBudgetCard';
import BudgetGroupTable from '@/ui/components/organisms/budget/BudgetGroupTable';
import BudgetOrigin from '@/ui/components/organisms/budget/BudgetOrigin';
import BudgetSummary from '@/ui/components/organisms/budget/BudgetSummary';
import CommonMonthCard from '@/ui/components/organisms/budget/CommonMonthCard';
import PrefillBudgetCard from '@/ui/components/organisms/budget/PrefillBudgetCard';
import SettlementCard from '@/ui/components/organisms/budget/SettlementCard';
import MonthNote, { MonthNoteButton } from '@/ui/components/organisms/commun/MonthNote';
import { groupLabel } from '@/ui/constants';

const BudgetPage = () => {
  const { month } = usePeriod();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [noteMonth, setNoteMonth] = useState<MonthKey | null>(null);
  const { kind, isCommon, lines, budget, origin, prefill, provision, annualSpent, groups } =
    useBudgetMonth(month);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budget"
        description={`${capitalize(monthLabel(month))}${isCommon ? ' · compte commun' : ''}`}
        actions={<MonthNoteButton month={month} onClick={() => setNoteMonth(month)} />}
      />
      <MonthNote
        key={`${month}-${noteMonth === month}`}
        month={month}
        editing={noteMonth === month}
        onEditingChange={(editing) => setNoteMonth(editing ? month : null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox
          checked={budget?.carryOver ?? false}
          onChange={(checked) => void report(finance.setCarryOver(month, checked))}
        >
          Reporter le budget non utilisé des {groupLabel('plaisir', kind).toLowerCase()} du mois précédent
        </Checkbox>
        <BudgetOrigin month={month} origin={origin} isDefined={budget !== null} />
      </div>
      {prefill && <PrefillBudgetCard month={month} planned={prefill} />}
      {isCommon ? (
        <>
          <CommonMonthCard month={month} />
          <SettlementCard month={month} />
        </>
      ) : (
        <BudgetSummary lines={lines} provision={provision} annualSpent={annualSpent} />
      )}
      {groups.map((group) => (
        <BudgetGroupTable key={group} group={group} lines={lines} month={month} />
      ))}
      <AnnualBudgetCard year={parseMonthKey(month).year} />
    </div>
  );
};

export default BudgetPage;
