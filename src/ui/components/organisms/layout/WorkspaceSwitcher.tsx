import { useFinanceState, useFinanceStore } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { Select } from '@/ui/components/atoms/form/Select';
import Text from '@/ui/components/atoms/Text';

const WorkspaceSwitcher = () => {
  const { workspaces, workspace } = useFinanceState();
  const store = useFinanceStore();
  const report = useReport();
  if (workspaces.length < 2) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5 border-t border-line-card px-2 pt-4">
      <Text variant="label" className="px-1">
        Espace
      </Text>
      <Select
        value={workspace.id}
        onChange={(workspaceId) => void report(store.switchWorkspace(workspaceId))}
        label="Espace affiché"
        className="h-9"
        options={workspaces.map((item) => ({
          value: item.id,
          label: item.name,
        }))}
      />
    </div>
  );
};

export default WorkspaceSwitcher;
