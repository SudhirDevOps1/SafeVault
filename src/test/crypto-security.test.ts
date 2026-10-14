import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  constantTimeCompare,
  deriveKeyArgon2id,
  createVerificationHashArgon2id,
  deriveKeyFromRecoveryPhrase,
  wrapKey,
  unwrapKey,
  bufferToBase64,
  base64ToBuffer,
} from '../utils/crypto';
import { generateMnemonic, validateMnemonic } from '../utils/bip39';
import { exportSharedVault, importSharedVault } from '../utils/secureShare';
import { generateTOTP, isValidTOTPSecret } from '../utils/totp';
import { hashPasswordSHA1 } from '../utils/breachCheck';

describe('Advanced Cryptographic Security & Tamper-Proofing', () => {
  let originalCrypto: any;

  beforeAll(() => {
    originalCrypto = (globalThis as any).crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  const masterPassword = 'MySuperSecurePassword2026!#$';
  const salt = generateSalt();

  it('AES-256-GCM should fail and throw when ciphertext is tampered with', async () => {
    const key = await deriveKey(masterPassword, salt);
    const plaintext = JSON.stringify({ secret: 'TopSecretBankingToken' });

    const { ciphertext, iv } = await encrypt(plaintext, key);

    // Tamper with the ciphertext (flip characters)
    const rawCipher = base64ToBuffer(ciphertext);
    rawCipher[0] ^= 0xff; // Invert first byte
    const tamperedCipher = bufferToBase64(rawCipher);

    // Must throw an error, preventing decrypted garbage or partial leaks
    await expect(decrypt(tamperedCipher, iv, key)).rejects.toThrow();
  });

  it('AES-256-GCM should fail when IV is tampered with or corrupted', async () => {
    const key = await deriveKey(masterPassword, salt);
    const plaintext = 'SensitiveUserNote';
    const { ciphertext, iv } = await encrypt(plaintext, key);

    const rawIv = base64ToBuffer(iv);
    rawIv[0] ^= 0x01;
    const tamperedIv = bufferToBase64(rawIv);

    await expect(decrypt(ciphertext, tamperedIv, key)).rejects.toThrow();
  });

  it('should successfully derive keys via Argon2id WASM with memory hardness', async () => {
    const key = await deriveKeyArgon2id(masterPassword, salt);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');

    const plaintext = 'Argon2id Protected Secret Data';
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);

    const hash = await createVerificationHashArgon2id(masterPassword, salt);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('BIP-39 mnemonic generation, validation, and key wrap/unwrap roundtrip', async () => {
    const phrase = generateMnemonic();
    expect(validateMnemonic(phrase)).toBe(true);

    const words = phrase.split(' ');
    expect(words.length).toBe(24);

    // Derive Master Key and Recovery Key
    const masterKey = await deriveKey(masterPassword, salt);
    const recSalt = generateSalt();
    const recoveryKey = await deriveKeyFromRecoveryPhrase(phrase, recSalt);

    // Wrap Master Key using Recovery Key
    const { ciphertext: wrappedKeyBase64, iv: wrappedIv } = await wrapKey(masterKey, recoveryKey);
    expect(wrappedKeyBase64).toBeDefined();

    // Unwrap Master Key
    const restoredMasterKey = await unwrapKey(wrappedKeyBase64, wrappedIv, recoveryKey);
    expect(restoredMasterKey).toBeDefined();

    // Verify restored Master Key can decrypt data encrypted by original Master Key
    const testSecret = 'BIP-39 Mnemonic Restored Data Verification';
    const { ciphertext, iv } = await encrypt(testSecret, masterKey);
    const decrypted = await decrypt(ciphertext, iv, restoredMasterKey);
    expect(decrypted).toBe(testSecret);
  });

  it('Constant-time comparison protects against side-channel timing attacks', () => {
    expect(constantTimeCompare('secretToken12345678', 'secretToken12345678')).toBe(true);
    expect(constantTimeCompare('secretToken12345678', 'secretToken12345679')).toBe(false);
    expect(constantTimeCompare('short', 'longerStringWithMoreBytes')).toBe(false);
    expect(constantTimeCompare('', '')).toBe(true);
  });

  it('Secure Share SFV-2.0 package: encryption, expiration, and password rejection', async () => {
    const sampleCredentials = [
      { id: '1', title: 'Test Shared Login', username: 'alice@example.com', password: 'SecretPassword987!' }
    ];
    const sharePassword = 'SharingPasswordMustBeLong123!';

    // Package with 1-day expiration
    const pkgJson = await exportSharedVault(sampleCredentials, sharePassword, 1);
    expect(pkgJson).toContain('SFV-2.0');

    // Successful decrypt
    const { credentials, isExpired } = await importSharedVault(pkgJson, sharePassword);
    expect(isExpired).toBe(false);
    expect(credentials.length).toBe(1);
    expect(credentials[0].title).toBe('Test Shared Login');

    // Wrong password should fail
    await expect(importSharedVault(pkgJson, 'WrongPasswordEntirely123!')).rejects.toThrow();

    // Short password should throw
    await expect(exportSharedVault(sampleCredentials, 'short')).rejects.toThrow();
  });

  it('RFC 6238 TOTP engine should validate Base32 secrets and calculate tokens', async () => {
    const secret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 "Hello!" test secret
    expect(isValidTOTPSecret(secret)).toBe(true);
    expect(isValidTOTPSecret('invalid!base32!')).toBe(false);

    const code = await generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('HaveIBeenPwned k-anonymity SHA-1 hash calculation', async () => {
    const hash = await hashPasswordSHA1('password123');
    expect(hash).toBe('CBFDAC6008F9CAB4083784CBD1874F76618D2A97');
    expect(hash.slice(0, 5)).toBe('CBFDA');
  });
});
