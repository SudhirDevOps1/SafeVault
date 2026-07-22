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
}

const db = new Dexie('SafeVaultDB') as Dexie & {
  vault: EntityTable<VaultRecord, 'id'>;
};

// Version 1: Initial schema
db.version(1).stores({
  vault: 'id',
});

// Version 2: Reserved for future migrations
// Example:
// db.version(2).stores({
//   vault: 'id, category, favorite',
//   credentials: 'id, title, category, favorite',  // if we split to individual records
// }).upgrade(tx => {
//   // Migration logic here
//   return tx.table('vault').toCollection().modify(record => {
//     record.newField = 'default';
//   });
// });

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
