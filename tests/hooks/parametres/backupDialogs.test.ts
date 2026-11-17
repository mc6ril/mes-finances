import { createInitialDataset } from '@/core/shared/seed';
import { type BackupDialogs, backupDialogsReducer, NO_BACKUP_DIALOG } from '@/hooks/parametres/backupDialogs';

const dataset = createInitialDataset('2026-11-17', () => 'audit');
const request = { entries: [], activeId: 'perso-uid' };
const file = { name: 'sauvegarde.json' };

describe('dialogues de la carte Sauvegardes', () => {
  it('démarre sans aucun dialogue ouvert', () => {
    expect(NO_BACKUP_DIALOG).toEqual({ restore: null, settings: null, locked: null, reset: false });
  });

  it('ouvre la confirmation de restauration et ferme la demande de mot de passe', () => {
    const locked: BackupDialogs = { ...NO_BACKUP_DIALOG, locked: { file, purpose: 'restore' } };
    expect(backupDialogsReducer(locked, { type: 'restore-requested', request })).toEqual({
      ...NO_BACKUP_DIALOG,
      restore: request,
    });
  });

  it('ouvre la confirmation d’import des réglages et ferme la demande de mot de passe', () => {
    const locked: BackupDialogs = { ...NO_BACKUP_DIALOG, locked: { file, purpose: 'settings' } };
    expect(backupDialogsReducer(locked, { type: 'settings-requested', dataset })).toEqual({
      ...NO_BACKUP_DIALOG,
      settings: dataset,
    });
  });

  it('demande le mot de passe d’un fichier protégé, en gardant son usage', () => {
    expect(
      backupDialogsReducer(NO_BACKUP_DIALOG, { type: 'password-required', file, purpose: 'settings' }),
    ).toEqual({ ...NO_BACKUP_DIALOG, locked: { file, purpose: 'settings' } });
  });

  it('ferme la demande de mot de passe quand le fichier est lu', () => {
    const locked: BackupDialogs = { ...NO_BACKUP_DIALOG, locked: { file, purpose: 'restore' } };
    expect(backupDialogsReducer(locked, { type: 'file-read' })).toEqual(NO_BACKUP_DIALOG);
  });

  it('ouvre puis ferme la confirmation de réinitialisation', () => {
    const opened = backupDialogsReducer(NO_BACKUP_DIALOG, { type: 'reset-requested' });
    expect(opened.reset).toBe(true);
    expect(backupDialogsReducer(opened, { type: 'closed', dialog: 'reset' })).toEqual(NO_BACKUP_DIALOG);
  });

  it('ne ferme que le dialogue demandé', () => {
    const state: BackupDialogs = { ...NO_BACKUP_DIALOG, restore: request, settings: dataset };
    expect(backupDialogsReducer(state, { type: 'closed', dialog: 'restore' })).toEqual({
      ...NO_BACKUP_DIALOG,
      settings: dataset,
    });
    expect(backupDialogsReducer(state, { type: 'closed', dialog: 'settings' })).toEqual({
      ...NO_BACKUP_DIALOG,
      restore: request,
    });
    const locked: BackupDialogs = { ...NO_BACKUP_DIALOG, locked: { file, purpose: 'restore' } };
    expect(backupDialogsReducer(locked, { type: 'closed', dialog: 'locked' })).toEqual(NO_BACKUP_DIALOG);
  });
});
