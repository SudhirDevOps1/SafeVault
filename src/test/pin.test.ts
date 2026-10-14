import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deriveKeyArgon2id, bufferToBase64 } from '../utils/crypto';

describe('Quick PIN Unlock Key Wrapping', () => {

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

  it('should activate Decoy Vault Mode when duress PIN is used', async () => {
    const { useVaultStore } = await import('../stores/vaultStore');
    const store = useVaultStore.getState();

    // Setup duress PIN
    await store.setupDuressPin('9999');
    expect(useVaultStore.getState().isDuressPinEnabled).toBe(true);

    // Unlock using duress PIN
    const unlocked = await useVaultStore.getState().unlockWithPin('9999');
    expect(unlocked).toBe(true);

    const state = useVaultStore.getState();
    expect(state.vaultState).toBe('unlocked');
    expect(state.isDecoyVault).toBe(true);
    expect(state.credentials.length).toBeGreaterThan(0);
    expect(state.credentials[0].title).toBe('Google (Personal)');
    expect(state.encryptionKey).toBeNull(); // Master key is NOT decrypted

    // Locking vault resets decoy status
    store.lockVault();
    expect(useVaultStore.getState().vaultState).toBe('locked');
    expect(useVaultStore.getState().isDecoyVault).toBe(false);
  });
});
