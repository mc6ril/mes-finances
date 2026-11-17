import { isInteger, isObject, isString } from '@/core/shared/typeCheck';
import { fail, ok, type Result } from '../shared/errors';
import { BACKUP_APP_ID } from './backup';

/**
 * Sauvegarde chiffrée par mot de passe, dans le navigateur : rien ne part vers un serveur.
 * Le contenu (une sauvegarde complète en JSON) est chiffré en AES-GCM 256 bits avec une clé dérivée
 * du mot de passe (PBKDF2-SHA-256, sel aléatoire). Seuls l'application et les paramètres de
 * chiffrement restent lisibles. Mot de passe perdu = sauvegarde irrécupérable.
 */
export const ENCRYPTED_BACKUP_KIND = 'encrypted';
export const ENCRYPTED_BACKUP_VERSION = 1;

export const MIN_BACKUP_PASSWORD_LENGTH = 10;

/** Contenu chiffré et paramètres pour le déchiffrer (octets en base64). */
export type EncryptedPayload = { iterations: number; salt: string; iv: string; data: string };

export type EncryptedBackup = {
  app: typeof BACKUP_APP_ID;
  kind: typeof ENCRYPTED_BACKUP_KIND;
  version: typeof ENCRYPTED_BACKUP_VERSION;
  cipher: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA-256';
} & EncryptedPayload;

export interface BackupCipherInterface {
  encrypt(plaintext: string, password: string): Promise<Result<EncryptedPayload>>;
  /** Échoue en `backup-wrong-password` si le mot de passe (ou le fichier) ne correspond pas. */
  decrypt(payload: EncryptedPayload, password: string): Promise<Result<string>>;
}

export const backupPasswordError = (password: string) =>
  password.length < MIN_BACKUP_PASSWORD_LENGTH ? ('backup-password-too-short' as const) : null;

/** Mot de passe choisi pour un export : assez long, puis identique à sa confirmation. */
export const validateBackupPassword = (
  password: string,
  confirmation: string,
): 'backup-password-too-short' | 'backup-password-mismatch' | null => {
  const tooShort = backupPasswordError(password);
  if (tooShort) {
    return tooShort;
  }
  return password === confirmation ? null : 'backup-password-mismatch';
};

export const createEncryptedBackup = (payload: EncryptedPayload): EncryptedBackup => ({
  app: BACKUP_APP_ID,
  kind: ENCRYPTED_BACKUP_KIND,
  version: ENCRYPTED_BACKUP_VERSION,
  cipher: 'AES-GCM-256',
  kdf: 'PBKDF2-SHA-256',
  ...payload,
});

export const isEncryptedBackup = (raw: unknown): boolean =>
  isObject(raw) && raw.app === BACKUP_APP_ID && raw.kind === ENCRYPTED_BACKUP_KIND;

export const readEncryptedBackup = (raw: unknown): Result<EncryptedPayload> => {
  if (!isObject(raw) || !isEncryptedBackup(raw)) {
    return fail('backup-not-recognized');
  }
  if (raw.version !== ENCRYPTED_BACKUP_VERSION) {
    return fail('backup-too-recent');
  }
  const { iterations, salt, iv, data } = raw;
  if (!isInteger(iterations) || iterations <= 0 || !isString(salt) || !isString(iv) || !isString(data)) {
    return fail('backup-corrupted', { detail: 'chiffrement' });
  }
  return ok({ iterations, salt, iv, data });
};
