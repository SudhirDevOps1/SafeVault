/**
 * SafeVault Local Database (IndexedDB via Dexie)
 * 
 * All data stored locally. No sync, no remote connections.
 * Includes schema migration support for future versions.
 */

import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/utils/logger';

interface VaultRecord {
  id: string;
  encryptedData: string;  // Base64 encrypted blob
  iv: string;             // Base64 IV
  salt: string;           // Base64 salt for key derivation
  verificationHash: string;
  verificationSalt: string;
  autoLockMinutes: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  kdf?: 'pbkdf2' | 'argon2id';
  recoverySalt?: string;
  recoveryVerificationHash?: string;
  recoveryVerificationSalt?: string;
  recoveryEncryptedData?: string;
  recoveryIv?: string;
}

export interface SafetySnapshotRecord {
  id: string;
  timestamp: number;
  version: string;
  reason: string;
  data: string;
}

const db = new Dexie('SafeVaultDB') as Dexie & {
  vault: EntityTable<VaultRecord, 'id'>;
  snapshots: EntityTable<SafetySnapshotRecord, 'id'>;
};

// Version 1: Initial schema
db.version(1).stores({
  vault: 'id',
});

// Version 2: Schema upgrade adding snapshots table for automated rollback and migration safety
db.version(2).stores({
  vault: 'id',
  snapshots: 'id, timestamp, version',
});

// Listen for database errors
db.on('blocked', () => {
  logger.warn('Database blocked - another tab may be using it');
});

db.on('versionchange', () => {
  logger.warn('Database version change detected');
  // Auto-close to allow upgrade
  db.close();
});

// Test database connection on init
(async () => {
  try {
    await db.open();
    logger.debug('Database initialized successfully');
  } catch (err) {
    logger.error('Database initialization failed', err);
  }
})();

export type { VaultRecord };
export { db };
