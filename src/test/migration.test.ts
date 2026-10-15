import { describe, it, expect, beforeEach } from 'vitest';
import { createSafetySnapshot, runAutoDataMigration, getLatestSafetySnapshot } from '../utils/migration';
import { APP_VERSION } from '../version';

describe('SafeVault Zero-Loss Data Migration & Safety Snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should create an immutable safety snapshot preserving critical keys and version', async () => {
    localStorage.setItem('safevault_base_emails', JSON.stringify(['admin@example.com']));
    localStorage.setItem('safevault_pin_attempts', '5');
    localStorage.setItem('safevault_theme', 'dark');

    const result = await createSafetySnapshot('test-backup');
    expect(result).toBe(true);

    const snapshot = getLatestSafetySnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.version).toBe(APP_VERSION);
    expect(snapshot?.reason).toBe('test-backup');
    expect(snapshot?.localStorageKeys['safevault_base_emails']).toBe(JSON.stringify(['admin@example.com']));
    expect(snapshot?.localStorageKeys['safevault_pin_attempts']).toBe('5');
    expect(snapshot?.localStorageKeys['safevault_theme']).toBe('dark');
  });

  it('should run non-destructive migration on version change without wiping existing data', async () => {
    // Setup existing user data from previous version
    localStorage.setItem('safevault_installed_version', '0.2.0');
    localStorage.setItem('safevault_base_emails', JSON.stringify(['myalias@gmail.com']));
    localStorage.setItem('safevault_deleted_ids', JSON.stringify(['deleted-id-123']));

    const migrationResult = await runAutoDataMigration();
    expect(migrationResult.migrated).toBe(true);
    expect(migrationResult.fromVersion).toBe('0.2.0');
    expect(migrationResult.toVersion).toBe(APP_VERSION);

    // Existing data MUST BE 100% PRESERVED
    expect(localStorage.getItem('safevault_base_emails')).toBe(JSON.stringify(['myalias@gmail.com']));
    expect(localStorage.getItem('safevault_deleted_ids')).toBe(JSON.stringify(['deleted-id-123']));

    // Default missing settings filled
    expect(localStorage.getItem('safevault_autofill_match_mode')).toBe('wildcard');
    expect(localStorage.getItem('safevault_installed_version')).toBe(APP_VERSION);

    // Running again without version change should be a no-op
    const noopResult = await runAutoDataMigration();
    expect(noopResult.migrated).toBe(false);
  });
});
