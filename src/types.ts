// SafeVault Type Definitions

export interface Credential {
  id: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  totpSecret: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VaultMetadata {
  id: string;
  salt: string;          // Base64-encoded salt for PBKDF2
  iv: string;            // Base64-encoded IV for AES-GCM
  verificationHash: string; // Hash to verify master password
  verificationSalt: string; // Salt for verification hash
  createdAt: number;
  updatedAt: number;
  autoLockMinutes: number;
  version: number;
}

// Sync payload wrapper — carries credentials + tombstone deleted IDs
// so that deletes propagate correctly across devices (no ghost resurrections)
export interface SyncPayload {
  credentials: Credential[];
  deletedIds: string[];      // Credential IDs deleted on sender device
  syncedAt: number;          // Unix timestamp of sync initiation
}

export interface EncryptedVault {
  id: string;
  data: string; // Base64-encoded encrypted blob
  metadata: VaultMetadata;
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean;
}

export type VaultState = 'loading' | 'setup' | 'locked' | 'unlocked';
export type SidebarView = 'all' | 'favorites' | 'trash' | 'generator' | 'settings' | 'aliases';
