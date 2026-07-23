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
} from '@/utils/crypto';
import { logger } from '@/utils/logger';

const AUTO_BACKUP_KEY = 'safevault_auto_backup';
const THEME_KEY = 'safevault_theme';

export type Theme = 'dark' | 'light';

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
  updateAvailable: string | null;
  networkApprovedThisSession: boolean;
  baseEmails: string[];

  // Actions
  initializeVault: () => Promise<void>;
  createVault: (masterPassword: string) => Promise<void>;
  unlockVault: (masterPassword: string) => Promise<void>;
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
  checkLatestRelease: () => Promise<void>;
  approveNetworkThisSession: () => void;
  
  addBaseEmail: (email: string) => void;
  removeBaseEmail: (email: string) => void;
  
  saveVault: () => Promise<void>;
  exportEncryptedBackup: () => Promise<string>;
  exportCSV: () => string;
  importEncryptedBackup: (data: string, password: string) => Promise<void>;
  performAutoBackup: () => Promise<void>;
  mergeCredentials: (incoming: Credential[]) => Promise<Credential[]>;
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
  checkForUpdates: localStorage.getItem('safevault_check_updates') === 'true',
  updateAvailable: null,
  networkApprovedThisSession: false,
  baseEmails: JSON.parse(localStorage.getItem('safevault_base_emails') || '["Sudhir@gmail.com"]'),

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

  createVault: async (masterPassword: string) => {
    set({ loading: true, error: null });
    try {
      const salt = generateSalt();
      const verificationSalt = generateSalt();
      
      const key = await deriveKey(masterPassword, salt);
      const verificationHash = await createVerificationHash(masterPassword, verificationSalt);
      
      const { ciphertext, iv } = await encrypt(JSON.stringify([]), key);
      
      await db.vault.put({
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
      });

      localStorage.setItem('safevault_privacy_seen', 'true');

      set({
        vaultState: 'unlocked',
        encryptionKey: key,
        credentials: [],
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info('Vault created successfully');
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

      const verificationHash = await createVerificationHash(
        masterPassword,
        vaultRecord.verificationSalt
      );

      if (!constantTimeCompare(verificationHash, vaultRecord.verificationHash)) {
        set({ error: 'Incorrect master password.', loading: false });
        logger.warn('Failed unlock attempt - incorrect password');
        return;
      }

      const key = await deriveKey(masterPassword, vaultRecord.salt);
      const decryptedData = await decrypt(vaultRecord.encryptedData, vaultRecord.iv, key);
      const credentials: Credential[] = JSON.parse(decryptedData);

      set({
        vaultState: 'unlocked',
        encryptionKey: key,
        credentials,
        autoLockMinutes: vaultRecord.autoLockMinutes,
        lastActivity: Date.now(),
        loading: false,
      });
      logger.info(`Vault unlocked, ${credentials.length} credentials loaded`);
    } catch (err) {
      logger.error('Failed to unlock vault', err);
      set({ error: 'Failed to unlock vault. Incorrect password or corrupted data.', loading: false });
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

      const oldHash = await createVerificationHash(oldPassword, vaultRecord.verificationSalt);
      if (!constantTimeCompare(oldHash, vaultRecord.verificationHash)) {
        set({ error: 'Current password is incorrect.', loading: false });
        return;
      }

      const newSalt = generateSalt();
      const newVerificationSalt = generateSalt();
      const newKey = await deriveKey(newPassword, newSalt);
      const newVerificationHash = await createVerificationHash(newPassword, newVerificationSalt);

      const { credentials } = get();
      const { ciphertext, iv } = await encrypt(JSON.stringify(credentials), newKey);

      await db.vault.put({
        ...vaultRecord,
        encryptedData: ciphertext,
        iv,
        salt: newSalt,
        verificationHash: newVerificationHash,
        verificationSalt: newVerificationSalt,
        updatedAt: Date.now(),
      });

      set({ encryptionKey: newKey, loading: false });
      logger.info('Master password changed successfully');
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
  },

  deleteCredential: async (id) => {
    const { credentials, selectedCredentialId } = get();
    set({
      credentials: credentials.filter(c => c.id !== id),
      selectedCredentialId: selectedCredentialId === id ? null : selectedCredentialId,
    });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Credential deleted');
  },

  mergeCredentials: async (incoming) => {
    const { credentials } = get();
    const map = new Map();
    
    // Index local credentials
    credentials.forEach(c => map.set(c.id, c));
    
    // Merge incoming credentials
    incoming.forEach(c => {
      const existing = map.get(c.id);
      if (!existing || c.updatedAt > existing.updatedAt) {
        map.set(c.id, c);
      }
    });
    
    const merged = Array.from(map.values());
    set({ credentials: merged });
    await get().saveVault();
    await get().performAutoBackup();
    logger.info('Vault credentials synchronized and merged');
    return merged;
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
    set({ checkForUpdates: enabled });
    localStorage.setItem('safevault_check_updates', String(enabled));
    if (enabled) {
      set({ networkApprovedThisSession: true }); // Explicit toggling in UI approves network for this session
      await get().checkLatestRelease();
    } else {
      set({ updateAvailable: null });
    }
  },

  checkLatestRelease: async () => {
    if (!get().checkForUpdates || !get().networkApprovedThisSession) return;
    try {
      const response = await fetch('https://api.github.com/repos/SudhirDevOps1/SafeVault/releases/latest');
      if (!response.ok) return;
      const data = await response.json();
      const latestVersion = data.tag_name;
      const currentVersion = 'v1.1.5'; // Bumped version to 1.1.5
      
      const cleanLatest = latestVersion.replace(/^v/, '');
      const cleanCurrent = currentVersion.replace(/^v/, '');

      if (cleanLatest !== cleanCurrent && cleanLatest > cleanCurrent) {
        set({ updateAvailable: latestVersion });
        logger.info(`Update available: ${latestVersion}`);
      } else {
        set({ updateAvailable: null });
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
}));
