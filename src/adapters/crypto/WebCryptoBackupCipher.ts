import type { BackupCipherInterface, EncryptedPayload } from '@/core/sauvegarde/encryptedBackup';
import { fail, ok, type Result } from '@/core/shared/errors';

/** Recommandation OWASP (2023) pour PBKDF2-HMAC-SHA-256. */
const DEFAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** Chiffrement des sauvegardes avec WebCrypto (navigateur, Node ≥ 20) : AES-GCM 256, clé PBKDF2. */
export class WebCryptoBackupCipher implements BackupCipherInterface {
  readonly #iterations: number;

  constructor(options: { iterations?: number } = {}) {
    this.#iterations = options.iterations ?? DEFAULT_ITERATIONS;
  }

  async #key(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async encrypt(plaintext: string, password: string): Promise<Result<EncryptedPayload>> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const key = await this.#key(password, salt, this.#iterations);
      const data = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext),
      );
      return ok({
        iterations: this.#iterations,
        salt: toBase64(salt),
        iv: toBase64(iv),
        data: toBase64(new Uint8Array(data)),
      });
    } catch {
      return fail('backup-encryption-failed');
    }
  }

  async decrypt(payload: EncryptedPayload, password: string): Promise<Result<string>> {
    try {
      const key = await this.#key(password, fromBase64(payload.salt), payload.iterations);
      const data = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(payload.iv) },
        key,
        fromBase64(payload.data),
      );
      return ok(new TextDecoder().decode(data));
    } catch {
      // AES-GCM authentifie le contenu : mauvais mot de passe et fichier altéré échouent pareil.
      return fail('backup-wrong-password');
    }
  }
}
