import { History } from 'lucide-react';
import { useMemo } from 'react';
import { useDataset } from '@/hooks/useFinance';
import { latestAuditEntries } from '@/core/shared/audit';
import { formatDateFr } from '@/core/shared/format';
import Card from '@/ui/design-system/Card';
import Text from '@/ui/design-system/Text';

const AUDIT_LIMIT = 40;

const AuditCard = () => {
  const { audit } = useDataset();
  const entries = useMemo(() => latestAuditEntries(audit, AUDIT_LIMIT), [audit]);
  return (
    <Card title="Historique des modifications" subtitle={`Les ${AUDIT_LIMIT} dernières actions`}>
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2">
            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
            <Text variant="small">
              <span className="tabular-nums">{formatDateFr(entry.at.slice(0, 10))}</span> ·{' '}
              <span className="font-medium text-ink-body">{entry.entity}</span> · {entry.summary}
            </Text>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default AuditCard;
