import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { deriveKey, encrypt, decrypt, constantTimeCompare, evaluatePasswordStrength } from '../utils/crypto';

describe('Cryptography Engine', () => {
  let originalCrypto: any;

  beforeAll(() => {
    originalCrypto = (globalThis as any).crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true
    });
  });

  it('should encrypt and decrypt data successfully', async () => {
    const password = 'my-super-secret-password-123!';
    const salt = 'Y29tcGxleF9zYWx0X2J5dGVzX2hlcmU='; // Valid Base64
    const plaintext = JSON.stringify({ secretMessage: 'SafeVault is secure!' });

    // Derive encryption key
    const key = await deriveKey(password, salt);
    expect(key).toBeDefined();

    // Encrypt
    const { ciphertext, iv } = await encrypt(plaintext, key);
    expect(ciphertext).toBeTypeOf('string');
    expect(iv).toBeTypeOf('string');

    // Decrypt
    const decrypted = await decrypt(ciphertext, iv, key); // Fix argument order: ciphertext, iv, key
    expect(decrypted).toBe(plaintext);
    const parsed = JSON.parse(decrypted);
    expect(parsed.secretMessage).toBe('SafeVault is secure!');
  });

  it('should verify constant-time comparison correctly', () => {
    expect(constantTimeCompare('hashA', 'hashA')).toBe(true);
    expect(constantTimeCompare('hashA', 'hashB')).toBe(false);
    expect(constantTimeCompare('hashA', 'longerHash')).toBe(false);
  });

  it('should evaluate password strength scores correctly', () => {
    const weak = evaluatePasswordStrength('123456');
    expect(weak.score).toBeLessThanOrEqual(1);

    const strong = evaluatePasswordStrength('aB3$kL9#mP0qZ!xyz123456'); // Longer for max score 4
    expect(strong.score).toBeGreaterThanOrEqual(4);
  });
});
