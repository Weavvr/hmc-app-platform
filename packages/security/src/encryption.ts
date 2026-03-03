import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM.
 * Requires ENCRYPTION_KEY env var (min 32 chars).
 * Returns format: iv:authTag:encryptedData (all hex-encoded)
 */
export function encrypt(text: string, encryptionKey?: string): string {
  const keyStr = encryptionKey ?? process.env.ENCRYPTION_KEY;
  if (!keyStr || keyStr.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(keyStr, 'utf-8').subarray(0, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt().
 * Requires the same ENCRYPTION_KEY used for encryption.
 */
export function decrypt(encryptedText: string, encryptionKey?: string): string {
  const keyStr = encryptionKey ?? process.env.ENCRYPTION_KEY;
  if (!keyStr || keyStr.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }

  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(keyStr, 'utf-8').subarray(0, 32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
