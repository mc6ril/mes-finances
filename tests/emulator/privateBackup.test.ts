import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { FirestoreFinanceRepository } from '@/adapters/firestore/FirestoreFinanceRepository';
import { FirestoreWorkspaceRegistry } from '@/adapters/firestore/FirestoreWorkspaceRegistry';
import { SyncMonitor } from '@/adapters/firestore/SyncMonitor';
import { toDocumentId } from '@/adapters/firestore/workspaceIds';
import { readAnyBackup, type WorkspaceData } from '@/core/sauvegarde/fullBackup';
import { COLLECTION_NAMES, itemKey } from '@/core/shared/collections';
import type { Dataset } from '@/core/shared/model';
import { FinanceStore } from '@/core/store/FinanceStore';

/**
 * Vérifie localement qu'une vraie sauvegarde complète passe dans Firestore sans perte (émulateur).
 * Le fichier reste dans private/ (ignoré par git) ; seules des empreintes sont comparées, aucune
 * donnée n'est affichée. Ignoré si le fichier est absent (CI). Autre fichier : FINANCES_BACKUP=chemin.
 */
const BACKUP = process.env.FINANCES_BACKUP ?? 'private/mes-finances-sauvegarde-complete-2026-11-14.json';
const OWNER = 'owner-a';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};

const fingerprint = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
    .slice(0, 16);

/** Empreinte par partie de l'espace, collections triées par clé (l'ordre n'est pas conservé). */
const fingerprints = (dataset: Dataset, ignoredAudit: Set<string> = new Set()) => ({
  schemaVersion: dataset.schemaVersion,
  settings: fingerprint(dataset.settings),
  ...Object.fromEntries(
    COLLECTION_NAMES.map((name) => {
      const items = (dataset[name] as object[])
        .filter((item) => name !== 'audit' || !ignoredAudit.has(itemKey(name, item)))
        .map((item) => [itemKey(name, item), item] as const)
        .sort(([a], [b]) => (a < b ? -1 : 1));
      return [name, `${items.length}:${fingerprint(items)}`];
    }),
  ),
});

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe.skipIf(!existsSync(BACKUP))('sauvegarde réelle vers Firestore', () => {
  let env: RulesTestEnvironment;
  let entries: WorkspaceData[] = [];
  let activeId = 'perso';

  const dbOf = () =>
    env.authenticatedContext(OWNER, { email_verified: true }).firestore() as unknown as Firestore;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-finances-backup',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
    const read = readAnyBackup(JSON.parse(readFileSync(BACKUP, 'utf8')));
    if (!read.ok || read.value.kind !== 'complete') {
      throw new Error(`Sauvegarde illisible : ${read.ok ? read.value.kind : read.error.code}`);
    }
    entries = read.value.entries;
    activeId = read.value.activeId;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('restaure tous les espaces puis les relit à l’identique', async () => {
    const monitor = new SyncMonitor();
    const repository = (db: Firestore) => (workspaceId: string) =>
      new FirestoreFinanceRepository(db, toDocumentId(workspaceId, OWNER), monitor);
    const writer = dbOf();
    const store = new FinanceStore(
      repository(writer),
      new FirestoreWorkspaceRegistry(writer, OWNER, monitor, memoryStorage()),
      () => `restauration-${Math.random().toString(36).slice(2)}`,
    );
    await store.start();
    const restored = await store.restoreAll(entries, activeId);
    expect(restored).toEqual({ ok: true, value: undefined });
    expect(await monitor.flush(20000)).toEqual({ ok: true, value: undefined });
    store.stop();

    const reader = dbOf();
    const registry = await new FirestoreWorkspaceRegistry(reader, OWNER, monitor, memoryStorage()).load();
    expect(registry.ok && registry.value.workspaces.map((item) => item.id).sort()).toEqual(
      entries.map((entry) => entry.workspace.id).sort(),
    );
    for (const entry of entries) {
      const loaded = await repository(reader)(entry.workspace.id).load();
      expect(loaded.ok).toBe(true);
      const dataset = loaded.ok ? loaded.value : null;
      expect(dataset).not.toBeNull();
      // La restauration ajoute une ligne au journal ; l'ouverture peut générer les récurrences du mois
      // et basculer les opérations échues : on compare donc l'état écrit, avant toute ouverture.
      const original = new Set(entry.dataset.audit.map((item) => item.id));
      const added = new Set(dataset!.audit.map((item) => item.id).filter((id) => !original.has(id)));
      expect(added.size).toBe(1);
      expect(fingerprints(dataset!, added)).toEqual(fingerprints(entry.dataset));
    }
  });
});
