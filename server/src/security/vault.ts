import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the provided secret string using SHA-256
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Output format: base64(iv:authTag:ciphertext)
 */
export function encryptPrivateKey(plaintext: string, secret: string = config.vaultEncryptionKey): string {
  if (!plaintext) {
    return '';
  }
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data with delimiter
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  return Buffer.from(combined, 'utf8').toString('base64');
}

/**
 * Decrypts AES-256-GCM encrypted ciphertext
 */
export function decryptPrivateKey(encryptedBase64: string, secret: string = config.vaultEncryptionKey): string {
  if (!encryptedBase64) {
    return '';
  }
  try {
    const raw = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    throw new Error(`Failed to decrypt key: ${err.message}`);
  }
}
