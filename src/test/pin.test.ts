import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { deriveKeyArgon2id, bufferToBase64 } from '../utils/crypto';

describe('Quick PIN Unlock Key Wrapping', () => {
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

  beforeEach(() => {
    const mockStore: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem(key: string) { return mockStore[key] || null; },
      setItem(key: string, value: string) { mockStore[key] = value.toString(); },
      removeItem(key: string) { delete mockStore[key]; },
      clear() { Object.keys(mockStore).forEach(k => delete mockStore[k]); }
    });
  });

  it('should derive a PIN key and wrap/unwrap simulated master key data', async () => {
    const pin = '4839';
    const salt = 'pinsalt-test-value';
    const rawMasterKeyHex = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    
    // Derive PIN derived transport key
    const saltBase64 = bufferToBase64(new TextEncoder().encode(salt)).slice(0, 16);
    const pinKey = await deriveKeyArgon2id(pin, saltBase64);
    expect(pinKey).toBeDefined();

    // Wrap raw simulated master key
    const rawMasterBytes = new TextEncoder().encode(rawMasterKeyHex);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      pinKey,
      rawMasterBytes
    );

    expect(wrapped).toBeDefined();

    // Decrypt (unwrap) using PIN Key
    const unwrapped = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      pinKey,
      wrapped
    );

    const restoredHex = new TextDecoder().decode(unwrapped);
    expect(restoredHex).toBe(rawMasterKeyHex);
  });
});
