/**
 * SafeVault Zustand Store
 * 
 * Manages vault state, credentials, and encryption key in memory.
 * All decrypted data is cleared when vault is locked.
 * 
 * Features:
 * - Auto-backup to localStorage (encrypted)
 * - Theme persistence
 * - Schema migrations via Dexie
 */

import { create } from 'zustand';
import type { Credential, VaultState, SidebarView } from '@/types';
import { db } from '@/utils/db';
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  createVerificationHash,
  constantTimeCompare,
  generateId,
  deriveKeyArgon2id,
  createVerificationHashArgon2id,
  deriveKeyFromRecoveryPhrase,
  wrapKey,
  unwrapKey,
  bufferToBase64,
  base64ToBuffer,
} from '@/utils/crypto';
import { validateMnemonic } from '@/utils/bip39';
import { logger } from '@/utils/logger';

const AUTO_BACKUP_KEY = 'safevault_auto_backup';
const THEME_KEY = 'safevault_theme';

export type Theme = 'dark' | 'light';

export interface AuditLogEntry {
  timestamp: number;
  action: string;
  details: string;
}

interface VaultStore {
  // State
  vaultState: VaultState;
  credentials: Credential[];
  encryptionKey: CryptoKey | null;
  selectedCredentialId: string | null;
  searchQuery: string;
  sidebarView: SidebarView;
  autoLockMinutes: number;
  lastActivity: number;
  showPrivacyPolicy: boolean;
  error: string | null;
  loading: boolean;
  theme: Theme;
  autoBackupEnabled: boolean;
  autoBackupInterval: 'change' | '1' | '2' | '7' | 'manual';
  backupDirectory: string;
  backupFormat: 'encrypted' | 'decrypted';
  lastBackup: number | null;
  checkForUpdates: boolean;
  strictOfflineMode: boolean;
  disableRemoteFavicons: boolean;
  updateAvailable: string | null;
  updateReleaseNotes: string | null;
  updateDownloadUrl: string | null;
  updateAssets: { name: string, browser_download_url: string }[];
  networkApprovedThisSession: boolean;
  baseEmails: string[];
  auditLog: AuditLogEntry[];
  honeypotCredentialId: string | null;
  // Sync tracking
  deletedCredentialIds: string[];  // Tombstone list — prevents ghost credential resurrection on merge
  lastSyncedAt: number | null;     // Unix timestamp of last successful sync

  // Actions
  initializeVault: () => Promise<void>;
  createVault: (masterPassword: string, recoveryPhrase?: string) => Promise<void>;
  unlockVault: (masterPassword: string) => Promise<void>;
  unlockVaultWithRecovery: (recoveryPhrase: string) => Promise<boolean>;
  lockVault: () => void;
  changeMasterPassword: (oldPassword: string, newPassword: string) => Promise<void>;
  
  addCredential: (cred: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCredential: (id: string, updates: Partial<Credential>) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  
  setSelectedCredential: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSidebarView: (view: SidebarView) => void;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
  setShowPrivacyPolicy: (show: boolean) => void;
  setError: (error: string | null) => void;
  resetActivity: () => void;
  setTheme: (theme: Theme) => void;
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  setAutoBackupInterval: (interval: 'change' | '1' | '2' | '7' | 'manual') => void;
  setBackupDirectory: (path: string) => void;
  setBackupFormat: (format: 'encrypted' | 'decrypted') => void;
  setCheckForUpdates: (enabled: boolean) => Promise<void>;
  setStrictOfflineMode: (enabled: boolean) => void;
  setDisableRemoteFavicons: (enabled: boolean) => void;
  checkLatestRelease: () => Promise<void>;
  approveNetworkThisSession: () => void;
  
  addBaseEmail: (email: string) => void;
  removeBaseEmail: (email: string) => void;
  addAuditLog: (action: string, details: string) => void;
  exportAuditLog: () => void;
  setHoneypotCredential: (id: string | null) => void;
  
  saveVault: () => Promise<void>;
  exportEncryptedBackup: () => Promise<string>;
  exportCSV: () => string;
  importEncryptedBackup: (data: string, password: string) => Promise<void>;
  performAutoBackup: () => Promise<void>;
  mergeCredentials: (incoming: Credential[], incomingDeletedIds?: string[]) => Promise<Credential[]>;
  getSyncPayload: () => { credentials: Credential[]; deletedIds: string[]; syncedAt: number };
  getSyncPayloadDoubleLayer: () => Promise<{ encryptedLayer1: { ciphertext: string; iv: string }; syncedAt: number }>;
  mergeCredentialsDoubleLayer: (encryptedLayer1: { ciphertext: string; iv: string }) => Promise<Credential[]>;
  isPinUnlockEnabled: boolean;
  pinAttemptsLeft: number;
  setupPinUnlock: (pin: string) => Promise<void>;
  disablePinUnlock: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultState: 'loading',
  credentials: [],
  encryptionKey: null,
  selectedCredentialId: null,
  searchQuery: '',
  sidebarView: 'all',
  autoLockMinutes: 5,
  lastActivity: Date.now(),
  showPrivacyPolicy: false,
  error: null,
  loading: false,
  theme: (localStorage.getItem(THEME_KEY) as Theme) || 'dark',
  autoBackupEnabled: localStorage.getItem('safevault_auto_backup') === 'true',
  autoBackupInterval: (localStorage.getItem('safevault_auto_backup_interval') as any) || 'change',
  backupDirectory: localStorage.getItem('safevault_backup_directory') || '',
  backupFormat: (localStorage.getItem('safevault_backup_format') as any) || 'encrypted',
  lastBackup: localStorage.getItem('safevault_last_backup') ? Number(localStorage.getItem('safevault_last_backup')) : null,
  checkForUpdates: localStorage.getItem('safevault_check_updates') !== 'false' && localStorage.getItem('safevault_strict_offline') !== 'true',
  strictOfflineMode: localStorage.getItem('safevault_strict_offline') === 'true',
  disableRemoteFavicons: localStorage.getItem('safevault_disable_remote_favicons') === 'true',
  updateAvailable: null,
  updateReleaseNotes: null,
  updateDownloadUrl: null,
  updateAssets: [],
  networkApprovedThisSession: false,
  baseEmails: JSON.parse(localStorage.getItem('safevault_base_emails') || '["user@example.com"]'),
  auditLog: [],
  honeypotCredentialId: localStorage.getItem('safevault_honeypot_id') || null,
  deletedCredentialIds: JSON.parse(localStorage.getItem('safevault_deleted_ids') || '[]'),
  lastSyncedAt: localStorage.getItem('safevault_last_synced') ? Number(localStorage.getItem('safevault_last_synced')) : null,
  isPinUnlockEnabled: !!localStorage.getItem('safevault_wrapped_key'),
  pinAttemptsLeft: Number(localStorage.getItem('safevault_pin_attempts') || '3'),

  initializeVault: async () => {
    const theme = (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      const vaultRecord = await db.vault.get('main');
      if (vaultRecord) {
        logger.info('Existing vault found');
        set({ vaultState: 'locked', autoLockMinutes: vaultRecord.autoLockMinutes });
      } else {
        const seen = localStorage.getItem('safevault_privacy_seen');
        logger.info('No vault found, starting setup');
        set({ vaultState: 'setup', showPrivacyPolicy: !seen });
      }
      get().checkLatestRelease();
    } catch (err) {
      logger.error('Failed to initialize vault', err);
      set({ vaultState: 'setup' });
    }
  },

  createVault: async (masterPassword: string, recoveryPhrase?: string) => {
    set({ loading: true, error: null });
    try {
      const salt = generateSalt();
      const verificationSalt = generateSalt();
      
      const key = await deriveKey(masterPassword, salt);
      const verificationHash = await createVerificationHash(masterPassword, verificationSalt);
      
      const { ciphertext, iv } = await encrypt(JSON.stringify([]), key);
      
      const record: any = {
        id: 'main',
        encryptedData: ciphertext,
        iv,
        salt,
        verificationHash,
        verificationSalt,
        autoLockMinutes: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        kdf: 'pbkdf2',
      };

      if (recoveryPhrase) {
        const recSalt = generateSalt();
        const recVerSalt = generateSalt();
        const recKey = await deriveKeyFromRecoveryPhrase(recoveryPhrase, recSalt);
        const recVerHash = await createVerificationHash(recoveryPhrase, recVerSalt);
        
        // Wrap the Master Key (key) using the Recovery Key (recKey)
        const { ciphertext: wrappedKeyHex, iv: wrappedIv } = await wrapKey(key, recKey);
        
        record.recoverySalt = recSalt;
        record.recoveryVerificationSalt = recVerSalt;
        record.recoveryVerificationHash = recVerHash;
        record.recoveryEncryptedData = wrappedKeyHex; // Holds the encrypted Master Key
        record.recoveryIv = wrappedIv;
      }

      await db.vault.put(record);
      localStorage.setItem('safevault_privacy_seen', 'true');

      set({
        vaultState: 'unlocked',
        encryptionKey: key,
        credentials: [],
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info('Vault created successfully using PBKDF2 and Key Wrap');
    } catch (err) {
      logger.error('Failed to create vault', err);
      set({ error: 'Failed to create vault. Please try again.', loading: false });
    }
  },

  unlockVault: async (masterPassword: string) => {
    set({ loading: true, error: null });
    try {
      const vaultRecord = await db.vault.get('main');
      if (!vaultRecord) {
        set({ error: 'No vault found.', loading: false });
        return;
      }

      let credentials: Credential[] = [];
      let key: CryptoKey;

      if (vaultRecord.kdf === 'argon2id') {
        const verificationHash = await createVerificationHashArgon2id(
          masterPassword,
          vaultRecord.verificationSalt
        );

        if (!constantTimeCompare(verificationHash, vaultRecord.verificationHash)) {
          set({ error: 'Incorrect master password.', loading: false });
          logger.warn('Failed unlock attempt - incorrect password');
          return;
        }

        key = await deriveKeyArgon2id(masterPassword, vaultRecord.salt);
        const decryptedData = await decrypt(vaultRecord.encryptedData, vaultRecord.iv, key);
        credentials = JSON.parse(decryptedData);
      } else {
        // Legacy PBKDF2 unlock
        const verificationHash = await createVerificationHash(
          masterPassword,
          vaultRecord.verificationSalt
        );

        if (!constantTimeCompare(verificationHash, vaultRecord.verificationHash)) {
          set({ error: 'Incorrect master password.', loading: false });
          logger.warn('Failed unlock attempt - incorrect password');
          return;
        }

        const legacyKey = await deriveKey(masterPassword, vaultRecord.salt);
        const decryptedData = await decrypt(vaultRecord.encryptedData, vaultRecord.iv, legacyKey);
        credentials = JSON.parse(decryptedData);
        key = legacyKey;
      }

      set({
        vaultState: 'unlocked',
        encryptionKey: key,
        credentials,
        autoLockMinutes: vaultRecord.autoLockMinutes,
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info(`Vault unlocked, ${credentials.length} credentials loaded`);
      get().addAuditLog('VAULT_UNLOCKED', `Vault unlocked — ${credentials.length} credentials loaded`);
    } catch (err) {
      logger.error('Failed to unlock vault', err);
      set({ error: 'Failed to unlock vault. Incorrect password or corrupted data.', loading: false });
    }
  },

  unlockVaultWithRecovery: async (recoveryPhrase: string) => {
    set({ loading: true, error: null });
    try {
      if (!validateMnemonic(recoveryPhrase)) {
        set({ error: 'Invalid recovery phrase format. Must be 24 space-separated english words.', loading: false });
        return false;
      }

      const vaultRecord = await db.vault.get('main');
      if (!vaultRecord || !vaultRecord.recoverySalt || !vaultRecord.recoveryEncryptedData || !vaultRecord.recoveryIv) {
        set({ error: 'Vault does not have recovery phrase setup configured.', loading: false });
        return false;
      }

      // Verify recovery verification hash if available
      if (vaultRecord.recoveryVerificationHash && vaultRecord.recoveryVerificationSalt) {
        const verHash = await createVerificationHash(recoveryPhrase, vaultRecord.recoveryVerificationSalt);
        if (!constantTimeCompare(verHash, vaultRecord.recoveryVerificationHash)) {
          set({ error: 'Incorrect recovery phrase.', loading: false });
          return false;
        }
      }

      const recKey = await deriveKeyFromRecoveryPhrase(recoveryPhrase, vaultRecord.recoverySalt);
      
      // Unwrap the Master Key using the Recovery Key
      const unwrappedMasterKey = await unwrapKey(
        vaultRecord.recoveryEncryptedData,
        vaultRecord.recoveryIv,
        recKey
      );
      
      // Decrypt the actual vault data using the unwrapped Master Key
      const decryptedData = await decrypt(vaultRecord.encryptedData, vaultRecord.iv, unwrappedMasterKey);
      const credentials: Credential[] = JSON.parse(decryptedData);

      set({
        vaultState: 'unlocked',
        encryptionKey: unwrappedMasterKey, // The active session key is the restored Master Key
        credentials,
        autoLockMinutes: vaultRecord.autoLockMinutes,
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info(`Vault successfully unlocked using recovery key unwrap, ${credentials.length} credentials loaded`);
      return true;
    } catch (err) {
      logger.error('Recovery unlock failed', err);
      set({ error: 'Failed to unlock using recovery phrase. Content decryption failed.', loading: false });
      return false;
    }
  },

  lockVault: () => {
    logger.info('Vault locked');
    set({
      vaultState: 'locked',
      credentials: [],
      encryptionKey: null,
      selectedCredentialId: null,
      searchQuery: '',
      error: null,
    });
    try {
      navigator.clipboard.writeText('');
    } catch { /* ignore */ }
  },

  changeMasterPassword: async (oldPassword: string, newPassword: string) => {
    set({ loading: true, error: null });
    try {
      const vaultRecord = await db.vault.get('main');
      if (!vaultRecord) throw new Error('No vault found');

      // Verify old password
      let isPasswordCorrect = false;
      if (vaultRecord.kdf === 'argon2id') {
        const oldHash = await createVerificationHashArgon2id(oldPassword, vaultRecord.verificationSalt);
        isPasswordCorrect = constantTimeCompare(oldHash, vaultRecord.verificationHash);
      } else {
        const oldHash = await createVerificationHash(oldPassword, vaultRecord.verificationSalt);
        isPasswordCorrect = constantTimeCompare(oldHash, vaultRecord.verificationHash);
      }

      if (!isPasswordCorrect) {
        set({ error: 'Current password is incorrect.', loading: false });
        return;
      }

      const newSalt = generateSalt();
      const newVerificationSalt = generateSalt();
      const newKey = await deriveKey(newPassword, newSalt);
      const newVerificationHash = await createVerificationHash(newPassword, newVerificationSalt);

      const { credentials } = get();
      const { ciphertext, iv } = await encrypt(JSON.stringify(credentials), newKey);

      const updatedRecord: any = {
        ...vaultRecord,
        encryptedData: ciphertext,
        iv,
        salt: newSalt,
        verificationHash: newVerificationHash,
        verificationSalt: newVerificationSalt,
        kdf: 'pbkdf2',
        updatedAt: Date.now(),
      };

      // Since the password changed, we must delete any legacy recovery wrapped key
      // because we cannot re-encrypt it without the recovery phrase in memory.
      delete updatedRecord.recoverySalt;
      delete updatedRecord.recoveryVerificationHash;
      delete updatedRecord.recoveryVerificationSalt;
      delete updatedRecord.recoveryEncryptedData;
      delete updatedRecord.recoveryIv;

      await db.vault.put(updatedRecord);

      set({ encryptionKey: newKey, loading: false });
      logger.info('Master password changed successfully using PBKDF2');
    } catch (err) {
      logger.error('Failed to change password', err);
      set({ error: 'Failed to change password.', loading: false });
    }
  },

  addCredential: async (cred) => {
    const now = Date.now();
    const newCred: Credential = {
      ...cred,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    
    const { credentials } = get();
    set({ credentials: [...credentials, newCred] });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Credential added');
    get().addAuditLog('CREDENTIAL_ADDED', `Added: "${newCred.title}" (${newCred.category})`);
  },

  updateCredential: async (id, updates) => {
    const { credentials } = get();
    const updated = credentials.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    );
    set({ credentials: updated });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Credential updated');
    const cred = get().credentials.find(c => c.id === id);
    get().addAuditLog('CREDENTIAL_UPDATED', `Updated: "${cred?.title ?? id}"`);
  },

  deleteCredential: async (id) => {
    const { credentials, selectedCredentialId, deletedCredentialIds } = get();
    const deletedCred = credentials.find(c => c.id === id);
    // Add to tombstone list so future syncs do not resurrect this credential
    const updatedDeletedIds = Array.from(new Set([...deletedCredentialIds, id]));
    localStorage.setItem('safevault_deleted_ids', JSON.stringify(updatedDeletedIds));
    set({
      credentials: credentials.filter(c => c.id !== id),
      selectedCredentialId: selectedCredentialId === id ? null : selectedCredentialId,
      deletedCredentialIds: updatedDeletedIds,
    });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Credential deleted');
    get().addAuditLog('CREDENTIAL_DELETED', `Deleted: "${deletedCred?.title ?? id}"`);
  },

  mergeCredentials: async (incoming, incomingDeletedIds = []) => {
    const { credentials, deletedCredentialIds } = get();
    const map = new Map();
    
    // Index local credentials
    credentials.forEach(c => map.set(c.id, c));
    
    // Merge all tombstone lists — union of local + remote deleted IDs
    const allDeletedIds = Array.from(new Set([...deletedCredentialIds, ...incomingDeletedIds]));
    localStorage.setItem('safevault_deleted_ids', JSON.stringify(allDeletedIds));

    // Merge incoming credentials (skip any that are tombstoned)
    incoming.forEach(c => {
      if (allDeletedIds.includes(c.id)) return; // Ghost resurrection prevention
      const existing = map.get(c.id);
      if (!existing || c.updatedAt > existing.updatedAt) {
        map.set(c.id, c);
      }
    });

    // Also remove any local credentials that were deleted on the remote device
    allDeletedIds.forEach(id => map.delete(id));
    
    const merged = Array.from(map.values());
    const now = Date.now();
    localStorage.setItem('safevault_last_synced', now.toString());
    set({ credentials: merged, deletedCredentialIds: allDeletedIds, lastSyncedAt: now });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Vault credentials synchronized and merged');
    return merged;
  },

  getSyncPayload: () => {
    const { credentials, deletedCredentialIds } = get();
    return {
      credentials,
      deletedIds: deletedCredentialIds,
      syncedAt: Date.now(),
    };
  },

  getSyncPayloadDoubleLayer: async () => {
    const { credentials, deletedCredentialIds, encryptionKey } = get();
    if (!encryptionKey) {
      throw new Error('Vault is locked. Cannot prepare double-layer sync package.');
    }
    const plainPayload = {
      credentials,
      deletedIds: deletedCredentialIds,
    };
    // LAYER 1: Encrypt using the local Vault Master Key
    const encryptedLayer1 = await encrypt(JSON.stringify(plainPayload), encryptionKey);
    return {
      encryptedLayer1,
      syncedAt: Date.now(),
    };
  },

  mergeCredentialsDoubleLayer: async (encryptedLayer1) => {
    const { encryptionKey } = get();
    if (!encryptionKey) {
      throw new Error('Vault is locked. Cannot decrypt double-layer sync package.');
    }
    // Wreck Layer 1 decryption using the same Master Vault Key
    const decryptedJson = await decrypt(encryptedLayer1.ciphertext, encryptedLayer1.iv, encryptionKey);
    const parsed = JSON.parse(decryptedJson);
    const incomingCredentials = parsed.credentials || [];
    const incomingDeletedIds = parsed.deletedIds || [];
    return get().mergeCredentials(incomingCredentials, incomingDeletedIds);
  },

  saveVault: async () => {
    try {
      const { encryptionKey, credentials } = get();
      if (!encryptionKey) return;

      const { ciphertext, iv } = await encrypt(JSON.stringify(credentials), encryptionKey);
      
      const vaultRecord = await db.vault.get('main');
      if (vaultRecord) {
        await db.vault.update('main', {
          encryptedData: ciphertext,
          iv,
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      logger.error('Failed to save vault', err);
    }
  },

  setSelectedCredential: (id) => set({ selectedCredentialId: id, lastActivity: Date.now() }),
  setSearchQuery: (query) => set({ searchQuery: query, lastActivity: Date.now() }),
  setSidebarView: (view) => set({ sidebarView: view, selectedCredentialId: null }),
  setShowPrivacyPolicy: (show) => set({ showPrivacyPolicy: show }),
  setError: (error) => set({ error }),
  resetActivity: () => set({ lastActivity: Date.now() }),

  setAutoLockMinutes: async (minutes) => {
    set({ autoLockMinutes: minutes });
    const vaultRecord = await db.vault.get('main');
    if (vaultRecord) {
      await db.vault.update('main', { autoLockMinutes: minutes });
    }
    logger.info(`Auto-lock set to ${minutes} minutes`);
  },

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem(THEME_KEY, theme);
    // Apply theme to document root
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  setAutoBackupEnabled: async (enabled) => {
    set({ autoBackupEnabled: enabled });
    localStorage.setItem('safevault_auto_backup', String(enabled));
    if (enabled) {
      await get().performAutoBackup();
    }
  },

  setAutoBackupInterval: (interval) => {
    set({ autoBackupInterval: interval });
    localStorage.setItem('safevault_auto_backup_interval', interval);
  },

  setBackupDirectory: (path) => {
    set({ backupDirectory: path });
    localStorage.setItem('safevault_backup_directory', path);
  },

  setBackupFormat: (format) => {
    set({ backupFormat: format });
    localStorage.setItem('safevault_backup_format', format);
  },

  setCheckForUpdates: async (enabled) => {
    if (get().strictOfflineMode && enabled) return; // Cannot enable updates in strict offline mode
    set({ checkForUpdates: enabled });
    localStorage.setItem('safevault_check_updates', String(enabled));
    if (enabled) {
      set({ networkApprovedThisSession: true }); // Explicit toggling in UI approves network for this session
      await get().checkLatestRelease();
    } else {
      set({ updateAvailable: null });
    }
  },

  setStrictOfflineMode: (enabled) => {
    localStorage.setItem('safevault_strict_offline', String(enabled));
    set({ strictOfflineMode: enabled });
    if (enabled) {
      // Force disable updates when strict offline is enabled
      set({ checkForUpdates: false, updateAvailable: null });
      localStorage.setItem('safevault_check_updates', 'false');
    }
  },

  setDisableRemoteFavicons: (enabled) => {
    localStorage.setItem('safevault_disable_remote_favicons', String(enabled));
    set({ disableRemoteFavicons: enabled });
  },

  checkLatestRelease: async () => {
    if (get().strictOfflineMode) return; // Strict Offline mode blocks all network checks
    if (!get().checkForUpdates) return;
    try {
      const response = await fetch('https://api.github.com/repos/SudhirDevOps1/SafeVault/releases/latest');
      if (!response.ok) return;
      const data = await response.json();
      const latestVersion = data.tag_name;
      const currentVersion = 'v2.0.0'; // Current client version
      
      const isNewerVersion = (latest: string, current: string): boolean => {
        const l = latest.split('.').map(Number);
        const c = current.split('.').map(Number);
        for (let i = 0; i < Math.max(l.length, c.length); i++) {
          const lVal = l[i] || 0;
          const cVal = c[i] || 0;
          if (lVal > cVal) return true;
          if (lVal < cVal) return false;
        }
        return false;
      };

      if (isNewerVersion(latestVersion.replace(/^v/, ''), currentVersion.replace(/^v/, ''))) {
        const assets = (data.assets || []).map((asset: any) => ({
          name: asset.name,
          browser_download_url: asset.browser_download_url,
        }));
        
        set({
          updateAvailable: latestVersion,
          updateReleaseNotes: data.body || 'No release notes provided.',
          updateDownloadUrl: data.html_url,
          updateAssets: assets,
        });
        logger.info(`Update available: ${latestVersion}`);
      } else {
        set({
          updateAvailable: null,
          updateReleaseNotes: null,
          updateDownloadUrl: null,
          updateAssets: [],
        });
      }
    } catch (err) {
      logger.error('Failed to check latest release', err);
    }
  },

  approveNetworkThisSession: () => {
    set({ networkApprovedThisSession: true });
    get().checkLatestRelease();
  },

  addBaseEmail: (email) => {
    const updated = [...new Set([...get().baseEmails, email.trim()])];
    localStorage.setItem('safevault_base_emails', JSON.stringify(updated));
    set({ baseEmails: updated });
  },

  removeBaseEmail: (email) => {
    const updated = get().baseEmails.filter(e => e !== email);
    localStorage.setItem('safevault_base_emails', JSON.stringify(updated));
    set({ baseEmails: updated });
  },

  performAutoBackup: async () => {
    const { autoBackupEnabled, autoBackupInterval, backupDirectory, backupFormat, encryptionKey, lastBackup } = get();
    if (!autoBackupEnabled || !encryptionKey) return;

    // Check interval condition (if not 'change' or 'manual')
    if (autoBackupInterval !== 'change' && autoBackupInterval !== 'manual' && lastBackup) {
      const days = Number(autoBackupInterval);
      if (!isNaN(days)) {
        const msDiff = Date.now() - lastBackup;
        const msThreshold = days * 24 * 60 * 60 * 1000;
        if (msDiff < msThreshold) {
          // Time threshold not reached, skip automatic execution
          return;
        }
      }
    }

    try {
      const backupData = backupFormat === 'decrypted' ? get().exportCSV() : await get().exportEncryptedBackup();
      const ext = backupFormat === 'decrypted' ? 'csv' : 'json';
      const filename = `safevault-autobackup-${Date.now()}.${ext}`;

      // Save to local cache
      localStorage.setItem(AUTO_BACKUP_KEY, backupData);
      localStorage.setItem('safevault_last_backup', String(Date.now()));
      set({ lastBackup: Date.now() });

      // Save to custom directory on Desktop (Electron)
      const isElectron = typeof window !== 'undefined' && 'safevault' in window && (window as any).safevault?.isElectron;
      if (isElectron && backupDirectory) {
        const result = await (window as any).safevault.writeBackupFile(backupDirectory, filename, backupData);
        if (result?.success) {
          logger.info(`Silent backup saved to ${result.path}`);
        } else {
          logger.error(`Silent backup failed: ${result?.error}`);
        }
      }
    } catch (err) {
      logger.error('Auto-backup failed', err);
    }
  },

  exportEncryptedBackup: async () => {
    const vaultRecord = await db.vault.get('main');
    if (!vaultRecord) throw new Error('No vault found');
    return JSON.stringify({
      type: 'safevault-backup',
      version: 1,
      exportedAt: Date.now(),
      data: vaultRecord,
    });
  },

  exportCSV: () => {
    const { credentials } = get();
    const headers = ['Title', 'URL', 'Username', 'Password', 'Notes', 'TOTP Secret', 'Category'];
    const rows = credentials.map(c => [
      c.title, c.url, c.username, c.password, c.notes, c.totpSecret, c.category,
    ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(','));
    logger.warn('CSV export created (plain text)');
    get().addAuditLog('EXPORT_CSV', `Plain-text CSV export of ${credentials.length} credentials created`);
    return [headers.join(','), ...rows].join('\n');
  },

  importEncryptedBackup: async (data: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const backup = JSON.parse(data);
      if (backup.type !== 'safevault-backup') {
        throw new Error('Invalid backup file format');
      }
      
      const record = backup.data;
      
      const verificationHash = await createVerificationHash(password, record.verificationSalt);
      if (!constantTimeCompare(verificationHash, record.verificationHash)) {
        set({ error: 'Incorrect password for this backup.', loading: false });
        logger.warn('Failed backup import - incorrect password');
        return;
      }

      const key = await deriveKey(password, record.salt);
      const decryptedData = await decrypt(record.encryptedData, record.iv, key);
      const credentials: Credential[] = JSON.parse(decryptedData);

      await db.vault.put(record);

      set({
        vaultState: 'unlocked',
        encryptionKey: key,
        credentials,
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info(`Backup imported successfully, ${credentials.length} credentials`);
    } catch (err) {
      logger.error('Failed to import backup', err);
      const msg = err instanceof Error ? err.message : 'Failed to import backup';
      set({ error: msg, loading: false });
    }
  },

  // ─── Privacy: Audit Log ────────────────────────────────────────────────────
  addAuditLog: (action, details) => {
    const entry: AuditLogEntry = { timestamp: Date.now(), action, details };
    const current = get().auditLog;
    // Keep max 500 entries in memory (never persisted to disk automatically)
    set({ auditLog: [entry, ...current].slice(0, 500) });
  },

  exportAuditLog: () => {
    const log = get().auditLog;
    const json = JSON.stringify({ 
      exported: new Date().toISOString(), 
      entries: log.map(e => ({
        time: new Date(e.timestamp).toISOString(),
        action: e.action,
        details: e.details,
      }))
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safevault-audit-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    get().addAuditLog('EXPORT_AUDIT_LOG', `Exported ${log.length} audit entries to local file`);
  },

  // ─── Privacy: Honeypot Credential ─────────────────────────────────────────
  setHoneypotCredential: (id) => {
    localStorage.setItem('safevault_honeypot_id', id ?? '');
    set({ honeypotCredentialId: id });
    if (id) {
      get().addAuditLog('HONEYPOT_SET', `Credential ${id} marked as honeypot/decoy`);
    } else {
      get().addAuditLog('HONEYPOT_CLEARED', 'Honeypot credential cleared');
    }
  },

  // ─── Quick PIN Unlock Security Actions ─────────────────────────────────────
  setupPinUnlock: async (pin) => {
    const { encryptionKey } = get();
    if (!encryptionKey) {
      throw new Error('Vault must be unlocked to configure PIN.');
    }
    try {
      set({ loading: true, error: null });
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = bufferToBase64(saltBytes);
      
      // Derive E2EE PIN Key
      const pinKey = await deriveKeyArgon2id(pin, saltBase64);
      
      // Wrap Master Key using PIN Key
      const rawMasterKey = await crypto.subtle.exportKey('raw', encryptionKey);
      const wrapped = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: window.crypto.getRandomValues(new Uint8Array(12)) },
        pinKey,
        rawMasterKey
      );
      
      const wrappedData = {
        ciphertext: bufferToBase64(new Uint8Array(wrapped.slice(0, wrapped.byteLength - 16))),
        iv: bufferToBase64(new Uint8Array(wrapped).slice(0, 12)),
        tag: bufferToBase64(new Uint8Array(wrapped).slice(wrapped.byteLength - 16)),
        salt: saltBase64,
      };
      
      localStorage.setItem('safevault_wrapped_key', JSON.stringify(wrappedData));
      localStorage.setItem('safevault_pin_attempts', '3');
      set({ isPinUnlockEnabled: true, pinAttemptsLeft: 3, loading: false });
      get().addAuditLog('PIN_UNLOCK_ENABLED', 'Quick PIN Unlock configured successfully');
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to setup PIN' });
      throw err;
    }
  },

  disablePinUnlock: () => {
    localStorage.removeItem('safevault_wrapped_key');
    localStorage.removeItem('safevault_pin_attempts');
    set({ isPinUnlockEnabled: false, pinAttemptsLeft: 3 });
    get().addAuditLog('PIN_UNLOCK_DISABLED', 'Quick PIN Unlock disabled');
  },

  unlockWithPin: async (pin) => {
    const wrappedStr = localStorage.getItem('safevault_wrapped_key');
    if (!wrappedStr) {
      throw new Error('PIN unlock is not enabled.');
    }
    const attempts = Number(localStorage.getItem('safevault_pin_attempts') || '3');
    if (attempts <= 0) {
      throw new Error('PIN Locked out. Use Master Password.');
    }
    
    try {
      set({ loading: true, error: null });
      const wrappedData = JSON.parse(wrappedStr);
      
      // Derive PIN Session Key
      const pinKey = await deriveKeyArgon2id(pin, wrappedData.salt);
      
      // Combine ciphertext and auth tag for decrypt
      const resCiphertext = base64ToBuffer(wrappedData.ciphertext);
      const resIv = base64ToBuffer(wrappedData.iv);
      const resTag = base64ToBuffer(wrappedData.tag);
      const combined = new Uint8Array(resCiphertext.length + resTag.length);
      combined.set(resCiphertext);
      combined.set(resTag, resCiphertext.length);
      
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: resIv as any },
        pinKey,
        combined.buffer as ArrayBuffer
      );
      
      // Import the decrypted raw master key
      const masterKey = await crypto.subtle.importKey(
        'raw',
        decryptedBuffer,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Load Vault data using restored master key
      const vaultRecord = await db.vault.get('main');
      if (!vaultRecord) throw new Error('Vault database main record missing');
      
      const decryptedVaultJson = await decrypt(vaultRecord.encryptedData, vaultRecord.iv, masterKey);
      const credentials = JSON.parse(decryptedVaultJson);
      
      localStorage.setItem('safevault_pin_attempts', '3');
      set({
        encryptionKey: masterKey,
        credentials,
        vaultState: 'unlocked',
        pinAttemptsLeft: 3,
        loading: false,
        lastActivity: Date.now(),
      });
      
      get().addAuditLog('VAULT_UNLOCKED_PIN', 'Vault unlocked using Quick PIN');
      return true;
    } catch (err: any) {
      const remainingAttempts = attempts - 1;
      localStorage.setItem('safevault_pin_attempts', remainingAttempts.toString());
      set({ pinAttemptsLeft: remainingAttempts, loading: false });
      
      if (remainingAttempts <= 0) {
        // LOCKOUT WIPE!
        localStorage.removeItem('safevault_wrapped_key');
        localStorage.removeItem('safevault_pin_attempts');
        set({ isPinUnlockEnabled: false, pinAttemptsLeft: 3, error: 'Too many incorrect PIN attempts. PIN unlock disabled.' });
        get().addAuditLog('PIN_LOCKOUT_WIPE', 'PIN lockout triggered: wrapped key database deleted');
      } else {
        set({ error: `Incorrect PIN. ${remainingAttempts} attempts remaining.` });
        get().addAuditLog('PIN_UNLOCK_FAILED', `PIN unlock failed: ${remainingAttempts} attempts remaining`);
      }
      return false;
    }
  },
}));
