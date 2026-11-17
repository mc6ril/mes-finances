import { latestAuditEntries } from '@/core/shared/audit';
import type { AuditEntry } from '@/core/shared/model';

const entry = (id: string, at: string): AuditEntry => ({
  id,
  at,
  action: 'creation',
  entity: 'Opération',
  summary: id,
});

describe('dernières entrées du journal', () => {
  const audit = [
    entry('a', '2026-11-01T10:00:00.000Z'),
    entry('c', '2026-11-03T10:00:00.000Z'),
    entry('b', '2026-11-02T10:00:00.000Z'),
  ];

  it('les trie de la plus récente à la plus ancienne et garde la limite', () => {
    expect(latestAuditEntries(audit, 2).map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('ne modifie pas le journal reçu', () => {
    latestAuditEntries(audit, 3);
    expect(audit.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });
});
