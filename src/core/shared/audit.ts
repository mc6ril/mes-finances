import type { AuditEntry } from './model';

/** Les `limit` dernières actions du journal, de la plus récente à la plus ancienne. */
export const latestAuditEntries = (audit: AuditEntry[], limit: number): AuditEntry[] =>
  [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
