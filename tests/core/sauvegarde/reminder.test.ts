import { backupReminder, snoozedUntil } from '@/core/sauvegarde/reminder';

const TODAY = '2026-11-14';

describe('rappel de sauvegarde', () => {
  it('rappelle une sauvegarde de plus de 30 jours', () => {
    expect(
      backupReminder(
        { lastFullBackupAt: '2026-10-15T09:00:00.000Z', reminderHiddenUntil: null },
        true,
        TODAY,
      ),
    ).toBeNull();
    expect(
      backupReminder(
        { lastFullBackupAt: '2026-10-13T09:00:00.000Z', reminderHiddenUntil: null },
        true,
        TODAY,
      ),
    ).toEqual({ kind: 'old', days: 32 });
  });

  it('rappelle l’absence de sauvegarde seulement s’il y a des opérations', () => {
    expect(backupReminder({ lastFullBackupAt: null, reminderHiddenUntil: null }, true, TODAY)).toEqual({
      kind: 'never',
    });
    expect(backupReminder({ lastFullBackupAt: null, reminderHiddenUntil: null }, false, TODAY)).toBeNull();
  });

  it('se tait pendant les 7 jours où il est masqué', () => {
    const hidden = { lastFullBackupAt: null, reminderHiddenUntil: snoozedUntil(TODAY) };
    expect(hidden.reminderHiddenUntil).toBe('2026-11-21');
    expect(backupReminder(hidden, true, '2026-11-21')).toBeNull();
    expect(backupReminder(hidden, true, '2026-11-22')).toEqual({ kind: 'never' });
  });
});
