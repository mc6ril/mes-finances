import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { FirestoreFinanceRepository } from '@/adapters/firestore/store/FirestoreFinanceRepository';
import { FirestoreWorkspaceRegistry } from '@/adapters/firestore/espaces/FirestoreWorkspaceRegistry';
import { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';
import { toDocumentId } from '@/adapters/firestore/espaces/workspaceIds';
import { readAnyBackup, type WorkspaceData } from '@/core/sauvegarde/fullBackup';
import { COLLECTION_NAMES, itemKey } from '@/core/shared/collections';
import type { Dataset } from '@/core/shared/model';
import { FinanceStore } from '@/core/store/FinanceStore';
import { isMirrored, mirroringTransfer } from '@/core/comptes/mirror';
import { isCounted, isInternalMove } from '@/core/comptes/balances';
import { accountPosition, type PatrimoineContext } from '@/core/patrimoine/patrimoine';
import { addMonths, daysBetween, monthEnd, monthKeyOf, todayIso } from '@/core/shared/dates';

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

/**
 * Lot 4 (une seule saisie pour l'épargne), migration candidate : les mouvements doublant un
 * virement (même montant, ±3 jours), aujourd'hui ignorés par le calcul, sont retirés.
 */
const withoutMirroredMovements = (dataset: Dataset): Dataset => ({
  ...dataset,
  savingsMovements: dataset.savingsMovements.filter(
    (movement) => !isMirrored(movement, dataset.transactions),
  ),
});

const contextOf = (dataset: Dataset): PatrimoineContext => ({
  transactions: dataset.transactions,
  movements: dataset.savingsMovements,
  valuations: dataset.valuations,
});

/** Fins de mois depuis la première ouverture de compte, plus aujourd'hui. */
const checkDates = (dataset: Dataset, today: string): string[] => {
  const first = dataset.accounts.map((account) => account.openingDate).sort()[0] ?? today;
  const dates = [today];
  for (let month = monthKeyOf(first); month < monthKeyOf(today); month = addMonths(month, 1)) {
    dates.push(monthEnd(month));
  }
  return dates;
};

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

  it('une seule saisie pour l’épargne : valeur et sommes versées inchangées pour chaque compte', () => {
    const today = todayIso();
    // Repères seuls (espace:compte:champ), jamais de montant ni de nom.
    const mismatches = new Set<string>();
    const counts = {
      removed: 0,
      kept: 0,
      keptDeposits: 0,
      keptBroker: 0,
      keptCommon: 0,
      nearMirror: 0,
      plannedMirror: 0,
      sharedTransfer: 0,
      broker: 0,
    };
    entries.forEach((entry, workspaceIndex) => {
      const before = entry.dataset;
      // Ancien calcul : les mouvements en miroir d'un virement sont ignorés à chaque calcul.
      const legacy: PatrimoineContext = {
        ...contextOf(before),
        movements: before.savingsMovements.filter((movement) => !isMirrored(movement, before.transactions)),
      };
      const after = withoutMirroredMovements(before);
      const migrated = contextOf(after);
      const dates = checkDates(before, today);
      before.accounts
        .filter((account) => account.group !== 'courant')
        .forEach((account, accountIndex) => {
          dates.forEach((date) => {
            const old = accountPosition(account, legacy, date);
            const current = accountPosition(account, migrated, date);
            if (old.value !== current.value) {
              mismatches.add(`${workspaceIndex}:${accountIndex}:valeur`);
            }
            if (old.contributions !== current.contributions) {
              mismatches.add(`${workspaceIndex}:${accountIndex}:verse`);
            }
          });
        });

      // Diagnostic de la migration, en nombres seulement.
      const removed = before.savingsMovements.filter((movement) => isMirrored(movement, before.transactions));
      counts.removed += removed.length;
      counts.broker += removed.filter((movement) => movement.externalId !== undefined).length;
      counts.kept += after.savingsMovements.length;
      const kept = after.savingsMovements.filter(
        (movement) => movement.kind === 'versement' || movement.kind === 'retrait',
      );
      counts.keptDeposits += kept.length;
      counts.keptBroker += kept.filter((movement) => movement.externalId !== undefined).length;
      const fromCommon = new Set(
        before.commonMonths.flatMap((month) => month.savingsTransfer?.movementIds ?? []),
      );
      counts.keptCommon += kept.filter((movement) => fromCommon.has(movement.id)).length;
      // Même compte, même montant qu'un virement passé, mais à plus de 3 jours : non rapprochés
      // aujourd'hui (comptés deux fois si c'est le même argent).
      counts.nearMirror += kept.filter((movement) =>
        before.transactions.some(
          (transaction) =>
            isCounted(transaction) &&
            isInternalMove(transaction) &&
            transaction.counterpartAccountId === movement.accountId &&
            Math.abs(transaction.amount) === movement.amount &&
            Math.abs(daysBetween(transaction.date, movement.date)) <= 31,
        ),
      ).length;
      // Versements gardés qui doubleront un virement encore prévu quand il passera.
      counts.plannedMirror += kept.filter((movement) =>
        before.transactions.some(
          (transaction) =>
            !isCounted(transaction) &&
            isInternalMove(transaction) &&
            transaction.counterpartAccountId === movement.accountId &&
            Math.abs(transaction.amount) === movement.amount &&
            Math.abs(daysBetween(transaction.date, movement.date)) <= 3,
        ),
      ).length;
      // Un même virement qui « absorbait » plusieurs mouvements.
      const byTransfer = new Map<string, number>();
      removed.forEach((movement) => {
        const transfer = mirroringTransfer(movement, before.transactions);
        if (transfer) {
          byTransfer.set(transfer.id, (byTransfer.get(transfer.id) ?? 0) + 1);
        }
      });
      counts.sharedTransfer += [...byTransfer.values()].filter((count) => count > 1).length;
    });
    console.info(`Lot 4, diagnostic de migration : ${JSON.stringify(counts)}`);
    expect([...mismatches]).toEqual([]);
  });
});
