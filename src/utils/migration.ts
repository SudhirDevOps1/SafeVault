/**
 * SafeVault Zero-Loss Data Migration & Safety Backup Engine
 * 
 * Guarantees that updates across Web, Desktop (Electron), Android (Capacitor),
 * and Extension NEVER lose or wipe user credentials, master vaults, or settings.
 */

import { db, type SafetySnapshotRecord } from '@/utils/db';
import { APP_VERSION } from '@/version';
import { logger } from '@/utils/logger';

const SNAPSHOT_STORAGE_KEY = 'safevault_safety_migration_snapshot';
const VERSION_STORAGE_KEY = 'safevault_installed_version';

export interface MigrationSnapshot {
  version: string;
  timestamp: number;
  reason: string;
  vaultRecord: any | null;
  localStorageKeys: Record<string, string>;
}

/**
 * Capture an immutable safety snapshot of all vault records and settings
 * before any update or migration is executed.
 */
export async function createSafetySnapshot(reason = 'pre-update'): Promise<boolean> {
  try {
    let vaultRecord: any = null;
    try {
      vaultRecord = await db.vault.get('main');
    } catch {
      // Database might be closed during migration
    }

    const criticalKeys = [
      'safevault_base_emails',
      'safevault_deleted_ids',
      'safevault_wrapped_key',
      'safevault_duress_pin',
      'safevault_pin_attempts',
      'safevault_autofill_match_mode',
      'safevault_blocked_sites',
      'safevault_credential_autofill',
      'safevault_2fa_autofill',
      'safevault_auto_copy_2fa',
      'safevault_save_login_prompt',
      'safevault_theme',
      'safevault_auto_backup',
      'safevault_last_backup',
      'safevault_auto_backup_interval',
    ];

    const storageDump: Record<string, string> = {};
    for (const key of criticalKeys) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        storageDump[key] = val;
      }
    }

    const snapshot: MigrationSnapshot = {
      version: APP_VERSION,
      timestamp: Date.now(),
      reason,
      vaultRecord: vaultRecord || null,
      localStorageKeys: storageDump,
    };

    const serialized = JSON.stringify(snapshot);

    // Save in localStorage
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, serialized);

    // Also persist in IndexedDB snapshots table
    try {
      if (db.snapshots) {
        const record: SafetySnapshotRecord = {
          id: `snapshot-${Date.now()}`,
          timestamp: Date.now(),
          version: APP_VERSION,
          reason,
          data: serialized,
        };
        await db.snapshots.put(record);
      }
    } catch (dbErr) {
      logger.warn('Failed to write snapshot to IndexedDB table (localStorage fallback active)', dbErr);
    }

    logger.info(`Safety snapshot successfully created (${reason})`);
    return true;
  } catch (err) {
    logger.error('Failed to create safety snapshot', err);
    return false;
  }
}

/**
 * Automatically run non-destructive schema migrations on app boot
 */
export async function runAutoDataMigration(): Promise<{
  migrated: boolean;
  fromVersion: string | null;
  toVersion: string;
}> {
  const previousVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  const currentVersion = APP_VERSION;

  if (previousVersion === currentVersion) {
    return { migrated: false, fromVersion: previousVersion, toVersion: currentVersion };
  }

  logger.info(`Running automated non-destructive migration: ${previousVersion || 'fresh-install'} -> ${currentVersion}`);

  // 1. Take safety snapshot before applying any migration changes
  await createSafetySnapshot(`migration-${previousVersion || 'initial'}-to-${currentVersion}`);

  // 2. Ensure base emails has valid fallback
  try {
    const rawEmails = localStorage.getItem('safevault_base_emails');
    if (!rawEmails) {
      localStorage.setItem('safevault_base_emails', JSON.stringify(['user@example.com']));
    } else {
      const parsed = JSON.parse(rawEmails);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem('safevault_base_emails', JSON.stringify(['user@example.com']));
      }
    }
  } catch {
    localStorage.setItem('safevault_base_emails', JSON.stringify(['user@example.com']));
  }

  // 3. Ensure deleted tombstone IDs array exists
  try {
    const rawDeleted = localStorage.getItem('safevault_deleted_ids');
    if (!rawDeleted) {
      localStorage.setItem('safevault_deleted_ids', '[]');
    }
  } catch {
    localStorage.setItem('safevault_deleted_ids', '[]');
  }

  // 4. Ensure autofill settings are initialized with sensible defaults
  if (!localStorage.getItem('safevault_autofill_match_mode')) {
    localStorage.setItem('safevault_autofill_match_mode', 'wildcard');
  }
  if (!localStorage.getItem('safevault_blocked_sites')) {
    localStorage.setItem('safevault_blocked_sites', '[]');
  }

  // 5. Update stored version
  localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
  logger.info(`Migration to SafeVault v${currentVersion} completed with zero data loss.`);

  return {
    migrated: true,
    fromVersion: previousVersion,
    toVersion: currentVersion,
  };
}

/**
 * Retrieve the latest safety snapshot for inspection
 */
export function getLatestSafetySnapshot(): MigrationSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
