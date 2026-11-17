import { MIN_BACKUP_PASSWORD_LENGTH, validateBackupPassword } from '@/core/sauvegarde/encryptedBackup';

const valid = 'x'.repeat(MIN_BACKUP_PASSWORD_LENGTH);

describe('mot de passe d’une sauvegarde', () => {
  it('accepte un mot de passe assez long et confirmé', () => {
    expect(validateBackupPassword(valid, valid)).toBeNull();
  });

  it('refuse un mot de passe trop court, avant même de regarder la confirmation', () => {
    const short = valid.slice(1);
    expect(validateBackupPassword(short, short)).toBe('backup-password-too-short');
    expect(validateBackupPassword(short, 'autre')).toBe('backup-password-too-short');
  });

  it('refuse une confirmation différente', () => {
    expect(validateBackupPassword(valid, `${valid}!`)).toBe('backup-password-mismatch');
  });
});
