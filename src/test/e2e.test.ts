import { describe, it, expect, beforeEach } from 'vitest';
import { useVaultStore } from '../stores/vaultStore';
import { generateMnemonic } from '../utils/bip39';
import { db } from '../utils/db';

describe('SafeVault Local End-to-End (E2E) Flow', () => {

  beforeEach(async () => {
    localStorage.clear();
    await db.vault.clear();
    useVaultStore.setState({
      vaultState: 'setup',
      credentials: [],
      encryptionKey: null,
      selectedCredentialId: null,
      searchQuery: '',
      error: null,
      isPinUnlockEnabled: false,
      pinAttemptsLeft: 3,
      deletedCredentialIds: [],
    });
  });

  it('complete vault life-cycle: creation, locking, unlocking, PIN, recovery, and tombstone sync', async () => {
    const store = useVaultStore.getState();
    const masterPassword = 'MyVaultMasterPassword2026!';
    const recoveryPhrase = generateMnemonic();

    // 1. Create Vault
    await store.createVault(masterPassword, recoveryPhrase);
    let state = useVaultStore.getState();
    expect(state.vaultState).toBe('unlocked');
    expect(state.encryptionKey).toBeDefined();

    // Verify record in IndexedDB
    const record = await db.vault.get('main');
    expect(record).toBeDefined();
    expect(record?.encryptedData).toBeDefined();
    expect(record?.recoveryEncryptedData).toBeDefined();

    // 2. Add Credentials
    await store.addCredential({
      title: 'GitHub Work Account',
      url: 'https://github.com/login',
      username: 'dev_engineer',
      password: 'GhSuperPassword987#',
      notes: '2FA via TOTP',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      category: 'Logins',
      favorite: true,
    });

    await store.addCredential({
      title: 'Banking Visa Card',
      url: 'https://bank.example.com',
      username: 'user_bank',
      password: 'BankPassword123!',
      notes: 'Company credit card',
      totpSecret: '',
      category: 'Payment Card',
      favorite: false,
      cardNumber: '4111222233334444',
      cardExpiry: '12/28',
      cardCVV: '123',
    });

    state = useVaultStore.getState();
    expect(state.credentials.length).toBe(2);

    // 3. Lock Vault
    store.lockVault();
    state = useVaultStore.getState();
    expect(state.vaultState).toBe('locked');
    expect(state.credentials.length).toBe(0);
    expect(state.encryptionKey).toBeNull();

    // 4. Failed Unlock with Wrong Password
    await store.unlockVault('WrongPasswordEntirely!');
    state = useVaultStore.getState();
    expect(state.vaultState).toBe('locked');
    expect(state.error).toContain('Incorrect master password');

    // 5. Successful Unlock with Master Password
    await store.unlockVault(masterPassword);
    state = useVaultStore.getState();
    expect(state.vaultState).toBe('unlocked');
    expect(state.credentials.length).toBe(2);
    expect(state.credentials.find(c => c.title === 'GitHub Work Account')).toBeDefined();

    // 6. Configure Quick PIN Unlock
    const quickPin = '7890';
    await store.setupPinUnlock(quickPin);
    state = useVaultStore.getState();
    expect(state.isPinUnlockEnabled).toBe(true);

    // Lock and Unlock with PIN
    store.lockVault();
    const pinSuccess = await store.unlockWithPin(quickPin);
    expect(pinSuccess).toBe(true);
    state = useVaultStore.getState();
    expect(state.vaultState).toBe('unlocked');
    expect(state.credentials.length).toBe(2);

    // 7. PIN Lockout Security Wipe
    store.lockVault();
    await store.unlockWithPin('0000'); // Fail 1
    await store.unlockWithPin('0001'); // Fail 2
    await store.unlockWithPin('0002'); // Fail 3 -> Lockout wipe
    state = useVaultStore.getState();
    expect(state.isPinUnlockEnabled).toBe(false);
    expect(localStorage.getItem('safevault_wrapped_key')).toBeNull();

    // 8. Restore Vault using BIP-39 Recovery Phrase
    const recoverySuccess = await store.unlockVaultWithRecovery(recoveryPhrase);
    expect(recoverySuccess).toBe(true);
    state = useVaultStore.getState();
    expect(state.vaultState).toBe('unlocked');
    expect(state.credentials.length).toBe(2);

    // 9. Sync Merge with Tombstone Deleted IDs (Anti-ghost resurrection)
    const credToDelete = state.credentials[0].id;
    await store.deleteCredential(credToDelete);

    state = useVaultStore.getState();
    expect(state.credentials.length).toBe(1);
    expect(state.deletedCredentialIds).toContain(credToDelete);

    // Simulate incoming sync from another device attempting to resurrect the deleted credential
    const incomingFromDeviceB = [
      {
        id: credToDelete,
        title: 'Ghost Credential',
        url: 'https://ghost.com',
        username: 'ghost',
        password: '123',
        notes: '',
        totpSecret: '',
        category: 'Logins',
        favorite: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'new-device-b-cred',
        title: 'New Legit Credential from Device B',
        url: 'https://deviceb.com',
        username: 'legit_user',
        password: 'Pass456DeviceB!',
        notes: '',
        totpSecret: '',
        category: 'Logins',
        favorite: false,
        createdAt: 2000,
        updatedAt: 2000,
      }
    ];

    const merged = await store.mergeCredentials(incomingFromDeviceB);
    // Deleted ID must be rejected by tombstone filter
    expect(merged.find(c => c.id === credToDelete)).toBeUndefined();
    // New legit credential must be merged
    expect(merged.find(c => c.id === 'new-device-b-cred')).toBeDefined();
    expect(merged.length).toBe(2);
  });
});
