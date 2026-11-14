import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { FirestoreFinanceRepository } from '@/adapters/firestore/store/FirestoreFinanceRepository';
import { FirestoreWorkspaceRegistry } from '@/adapters/firestore/espaces/FirestoreWorkspaceRegistry';
import { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';
import { byteSize } from '@/adapters/firestore/store/sharding';
import { FinanceStore } from '@/core/store/FinanceStore';
import { DEFAULT_WORKSPACE } from '@/core/espaces/workspaces';
import type { Dataset } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../core/fixtures';

/** Adapter Firestore contre l'émulateur, avec les vraies règles. */
const OWNER = 'owner-a';
const PARTNER = 'partner-b';
const STRANGER = 'stranger-c';
const COMMON = 'commun-ab';

let env: RulesTestEnvironment;

const dbOf = (uid: string): Firestore =>
  env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

const seedWorkspace = async (id: string, ownerId: string, memberIds = [ownerId], kind = 'commun') => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, `workspaces/${id}`), {
      ownerId,
      memberIds,
      kind,
      name: kind === 'commun' ? 'Commun' : 'Perso',
      createdAt: Timestamp.now(),
    });
  });
};

const repositoryOf = (uid: string, documentId: string, options = {}) => {
  const monitor = new SyncMonitor();
  return { repository: new FirestoreFinanceRepository(dbOf(uid), documentId, monitor, options), monitor };
};

const sortedIds = (items: { id: string }[] | undefined) => (items ?? []).map((item) => item.id).sort();

const sample = (): Dataset => ({
  ...createInitialDataset('2026-11-01', () => 'audit-1', 'commun'),
  transactions: [
    aTransaction({
      id: 'courses',
      date: '2026-11-03',
      amount: -4200,
      imputation: { kind: 'charge', memberId: 'm1' },
    }),
    aTransaction({ id: 'salaire', date: '2026-11-02', amount: 250000, type: 'revenu' }),
  ],
  budgets: [{ month: '2026-11', planned: { 'cat-courses': 40000 }, carryOver: true }],
  yearBudgets: [{ year: '2026', planned: { 'cat-voyages': 120000 } }],
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances-adapter',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('dépôt d’un espace', () => {
  it('renvoie null pour un espace pas encore rempli', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { repository } = repositoryOf(OWNER, COMMON);
    expect(await repository.load()).toEqual({ ok: true, value: null });
    await repository.close();
  });

  it('enregistre un espace complet et le relit à l’identique', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { repository, monitor } = repositoryOf(OWNER, COMMON);
    await repository.load();
    const dataset = sample();
    expect(await repository.replaceAll(dataset)).toEqual({ ok: true, value: undefined });
    expect(await monitor.flush(5000)).toEqual({ ok: true, value: undefined });
    await repository.close();

    const reader = repositoryOf(OWNER, COMMON).repository;
    const loaded = await reader.load();
    expect(loaded.ok).toBe(true);
    const read = loaded.ok ? loaded.value : null;
    expect(read?.settings).toEqual(dataset.settings);
    expect(read?.schemaVersion).toBe(dataset.schemaVersion);
    expect(sortedIds(read?.transactions)).toEqual(['courses', 'salaire']);
    expect(read?.transactions.find((item) => item.id === 'courses')).toEqual(dataset.transactions[0]);
    expect(read?.budgets).toEqual(dataset.budgets);
    expect(read?.yearBudgets).toEqual(dataset.yearBudgets);
    expect(sortedIds(read?.categories)).toEqual(sortedIds(dataset.categories));
    await reader.close();
  });

  it('ajoute, remplace et supprime un élément sans toucher aux autres', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { repository, monitor } = repositoryOf(OWNER, COMMON);
    await repository.load();
    await repository.replaceAll(sample());
    await repository.put('transactions', [
      aTransaction({ id: 'courses', date: '2026-11-03', amount: -5000 }),
      aTransaction({ id: 'cine', date: '2026-11-04', amount: -1800 }),
    ]);
    await repository.remove('transactions', ['salaire']);
    await repository.saveSettings({ ...sample().settings, personalEnvelope: 50000 });
    await monitor.flush(5000);
    await repository.close();

    const loaded = await repositoryOf(OWNER, COMMON).repository.load();
    const read = loaded.ok ? loaded.value : null;
    expect(sortedIds(read?.transactions)).toEqual(['cine', 'courses']);
    const courses = read?.transactions.find((item) => item.id === 'courses');
    expect(courses?.amount).toBe(-5000);
    // Remplacement entier : l'imputation retirée ne survit pas.
    expect(courses?.imputation).toBeUndefined();
    expect(read?.settings.personalEnvelope).toBe(50000);
  });

  it('range le journal du plus récent au plus ancien', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { repository, monitor } = repositoryOf(OWNER, COMMON);
    await repository.load();
    const dataset = sample();
    await repository.replaceAll({
      ...dataset,
      audit: [
        { id: 'zz', at: '2026-11-01T10:00:00.000Z', action: 'creation', entity: 'A', summary: 'ancien' },
        { id: 'aa', at: '2026-11-03T10:00:00.000Z', action: 'creation', entity: 'B', summary: 'récent' },
      ],
    });
    await monitor.flush(5000);
    await repository.close();
    const loaded = await repositoryOf(OWNER, COMMON).repository.load();
    expect(loaded.ok && loaded.value?.audit.map((entry) => entry.summary)).toEqual(['récent', 'ancien']);
  });

  it('redécoupe une collection qui grossit, sans rien perdre', async () => {
    await seedWorkspace(COMMON, OWNER);
    const options = { targetBytes: 2000, splitBytes: 4000 };
    const { repository, monitor } = repositoryOf(OWNER, COMMON, options);
    await repository.load();
    await repository.replaceAll(sample());
    const many = Array.from({ length: 40 }, (_, index) =>
      aTransaction({ id: `tx-${index}`, date: '2026-11-05', comment: 'note '.repeat(10) }),
    );
    for (const item of many) {
      await repository.put('transactions', [item]);
    }
    await monitor.flush(5000);
    await repository.close();

    const meta = await getDoc(doc(dbOf(OWNER), `workspaces/${COMMON}`));
    const count = (meta.data()?.layout as Record<string, number>).transactions ?? 0;
    expect(count).toBeGreaterThan(1);
    const shards = await getDocs(collection(dbOf(OWNER), `workspaces/${COMMON}/data`));
    shards.docs
      .filter((shard) => shard.id.startsWith('transactions__'))
      .forEach((shard) => expect(byteSize(shard.data())).toBeLessThan(4000 + 1000));
    const loaded = await repositoryOf(OWNER, COMMON, options).repository.load();
    expect(sortedIds(loaded.ok ? loaded.value?.transactions : [])).toEqual(
      ['courses', 'salaire', ...many.map((item) => item.id)].sort(),
    );
  });

  it('fait apparaître chez l’invité une modification du propriétaire, sans recharger', async () => {
    await seedWorkspace(COMMON, OWNER, [OWNER, PARTNER]);
    const owner = repositoryOf(OWNER, COMMON);
    await owner.repository.load();
    await owner.repository.replaceAll(sample());
    await owner.monitor.flush(5000);

    const partner = repositoryOf(PARTNER, COMMON);
    await partner.repository.load();
    const received: Dataset[] = [];
    partner.repository.watch((dataset) => received.push(dataset));
    await owner.repository.put('transactions', [
      aTransaction({ id: 'resto', date: '2026-11-06', amount: -3500 }),
    ]);
    await vi.waitFor(() =>
      expect(received.at(-1)?.transactions.some((item) => item.id === 'resto')).toBe(true),
    );
    await owner.repository.close();
    await partner.repository.close();
  });

  it('refuse l’espace commun à un autre compte', async () => {
    await seedWorkspace(COMMON, OWNER, [OWNER, PARTNER]);
    const { repository } = repositoryOf(STRANGER, COMMON);
    expect(await repository.load()).toEqual({ ok: false, error: { code: 'sync-permission-denied' } });
    await repository.close();
  });

  it('efface toutes les données de l’espace', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { repository, monitor } = repositoryOf(OWNER, COMMON);
    await repository.load();
    await repository.replaceAll(sample());
    await monitor.flush(5000);
    await repository.close();
    const doomed = repositoryOf(OWNER, COMMON);
    expect(await doomed.repository.destroy()).toEqual({ ok: true, value: undefined });
    await doomed.monitor.flush(5000);
    const shards = await getDocs(collection(dbOf(OWNER), `workspaces/${COMMON}/data`));
    expect(shards.empty).toBe(true);
  });
});

describe('liste des espaces', () => {
  const registryOf = (uid: string) => {
    const monitor = new SyncMonitor();
    return { registry: new FirestoreWorkspaceRegistry(dbOf(uid), uid, monitor, memoryStorage()), monitor };
  };

  it('crée l’espace principal à la première connexion', async () => {
    const { registry, monitor } = registryOf(OWNER);
    const loaded = await registry.load();
    expect(loaded).toEqual({ ok: true, value: { workspaces: [DEFAULT_WORKSPACE], activeId: 'perso' } });
    await monitor.flush(5000);
    const main = await getDoc(doc(dbOf(OWNER), `workspaces/perso-${OWNER}`));
    expect(main.data()).toMatchObject({ ownerId: OWNER, memberIds: [OWNER], kind: 'perso', name: 'Perso' });
  });

  it('liste ses espaces avec leur rôle, sans ceux des autres', async () => {
    await seedWorkspace(`perso-${OWNER}`, OWNER, [OWNER], 'perso');
    await seedWorkspace(`perso-${PARTNER}`, PARTNER, [PARTNER], 'perso');
    await seedWorkspace(COMMON, OWNER, [OWNER, PARTNER]);
    const partner = await registryOf(PARTNER).registry.load();
    expect(partner.ok && partner.value.workspaces).toEqual(
      expect.arrayContaining([
        { id: 'perso', name: 'Perso', kind: 'perso', role: 'owner', shared: false },
        { id: COMMON, name: 'Commun', kind: 'commun', role: 'guest', shared: true },
      ]),
    );
    expect(partner.ok && partner.value.workspaces).toHaveLength(2);
    const stranger = await registryOf(STRANGER).registry.load();
    expect(stranger.ok && stranger.value.workspaces.map((item) => item.id)).toEqual(['perso']);
  });

  it('crée, renomme et supprime un espace, et mémorise l’espace actif', async () => {
    const { registry, monitor } = registryOf(OWNER);
    await registry.load();
    await registry.create({ id: 'maison', name: 'Maison', kind: 'commun', role: 'owner' });
    await registry.rename('maison', 'Maison 2');
    registry.setActive('maison');
    await monitor.flush(5000);
    const reloaded = await registry.load();
    expect(reloaded.ok && reloaded.value.activeId).toBe('maison');
    expect(reloaded.ok && reloaded.value.workspaces.find((item) => item.id === 'maison')?.name).toBe(
      'Maison 2',
    );
    await registry.remove('maison');
    await monitor.flush(5000);
    await env.withSecurityRulesDisabled(async (context) => {
      const removed = await getDoc(doc(context.firestore() as unknown as Firestore, 'workspaces/maison'));
      expect(removed.exists()).toBe(false);
    });
  });

  it('signale en direct un espace rejoint ou retiré', async () => {
    await seedWorkspace(COMMON, OWNER);
    const { registry } = registryOf(PARTNER);
    await registry.load();
    const seen: string[][] = [];
    const stop = registry.watch((workspaces) => seen.push(workspaces.map((item) => item.id)));
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, `workspaces/${COMMON}`), {
        ownerId: OWNER,
        memberIds: [OWNER, PARTNER],
        kind: 'commun',
        name: 'Commun',
        createdAt: Timestamp.now(),
      });
    });
    await vi.waitFor(() => expect(seen.at(-1)).toContain(COMMON));
    stop();
  });
});

describe('store branché sur Firestore', () => {
  it('crée l’espace principal, enregistre une saisie et la montre sur un autre appareil', async () => {
    const monitor = new SyncMonitor();
    const deviceA = new FinanceStore(
      (workspaceId) =>
        new FirestoreFinanceRepository(
          dbOf(OWNER),
          workspaceId === 'perso' ? `perso-${OWNER}` : workspaceId,
          monitor,
        ),
      new FirestoreWorkspaceRegistry(dbOf(OWNER), OWNER, monitor, memoryStorage()),
      () => `id-${Math.random().toString(36).slice(2)}`,
    );
    await deviceA.start();
    expect(deviceA.getSnapshot().status).toBe('ready');
    await deviceA.upsert('transactions', [aTransaction({ id: 'pain', date: '2026-11-07', amount: -250 })], {
      action: 'creation',
      entity: 'Opération',
      summary: 'Pain',
    });
    await monitor.flush(5000);

    const deviceB = new FinanceStore(
      (workspaceId) =>
        new FirestoreFinanceRepository(
          dbOf(OWNER),
          workspaceId === 'perso' ? `perso-${OWNER}` : workspaceId,
          monitor,
        ),
      new FirestoreWorkspaceRegistry(dbOf(OWNER), OWNER, monitor, memoryStorage()),
      () => `id-${Math.random().toString(36).slice(2)}`,
    );
    await deviceB.start();
    expect(deviceB.getSnapshot().dataset?.transactions.map((item) => item.id)).toContain('pain');
    deviceA.stop();
    deviceB.stop();
  });
});
