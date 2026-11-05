import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
/** Recommended IV size for GCM. */
const IV_BYTES = 12;
const KEY_BYTES = 32;
/** Prefix of the stored format, to be able to change it later. */
const VERSION = 'v1';

/**
 * Encrypts the API keys before they are stored in the database
 * (AES-256-GCM: an altered value fails to decrypt instead of giving garbage).
 *
 * The master key comes from API_KEY_ENCRYPTION_KEY: 32 random bytes in
 * base64, generated with `openssl rand -base64 32`. Changing it makes the
 * stored keys unreadable: they must then be sent again.
 */
@Injectable()
export class ApiKeyCipher {
  private readonly key: Buffer;

  constructor() {
    const encoded = process.env.API_KEY_ENCRYPTION_KEY;
    if (!encoded) {
      throw new Error(
        'API_KEY_ENCRYPTION_KEY is not set (generate one with `openssl rand -base64 32`)',
      );
    }
    this.key = Buffer.from(encoded, 'base64');
    if (this.key.length !== KEY_BYTES) {
      throw new Error(
        `API_KEY_ENCRYPTION_KEY must be ${KEY_BYTES} bytes encoded in base64 (got ${this.key.length} bytes)`,
      );
    }
  }

  /** Returns "v1.<iv>.<auth tag>.<ciphertext>", all in base64. */
  encrypt(plainText: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    return [VERSION, iv, cipher.getAuthTag(), encrypted]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64'),
      )
      .join('.');
  }

  /** @throws Error if the value is malformed, altered or was encrypted with another key */
  decrypt(stored: string): string {
    const [version, iv, tag, encrypted] = stored.split('.');
    if (version !== VERSION || !iv || !tag || encrypted === undefined) {
      throw new Error('Unknown encrypted API key format');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
