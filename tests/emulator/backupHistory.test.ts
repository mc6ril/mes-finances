import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { FirestoreBackupHistory } from '@/adapters/firestore/sauvegarde/FirestoreBackupHistory';
import { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';

let env: RulesTestEnvironment;

const historyOf = (uid: string, monitor = new SyncMonitor()) =>
  new FirestoreBackupHistory(
    env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore,
    uid,
    monitor,
  );

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finances-backups',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('suivi des sauvegardes sur Firestore', () => {
  it('ne connaît aucune sauvegarde au départ', async () => {
    expect(await historyOf('a').load()).toEqual({
      ok: true,
      value: { lastFullBackupAt: null, reminderHiddenUntil: null },
    });
  });

  it('retrouve les dates enregistrées, depuis un autre appareil', async () => {
    const monitor = new SyncMonitor();
    const device = historyOf('a', monitor);
    expect(device.save({ lastFullBackupAt: '2026-11-14T10:00:00.000Z', reminderHiddenUntil: null })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(device.save({ reminderHiddenUntil: '2026-11-21' }).ok).toBe(true);
    expect(await monitor.flush(10000)).toEqual({ ok: true, value: undefined });
    expect(await historyOf('a').load()).toEqual({
      ok: true,
      value: { lastFullBackupAt: '2026-11-14T10:00:00.000Z', reminderHiddenUntil: '2026-11-21' },
    });
    expect(await historyOf('b').load()).toMatchObject({ ok: true, value: { lastFullBackupAt: null } });
  });
});
