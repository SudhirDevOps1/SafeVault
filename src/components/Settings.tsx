import { useState } from 'react';
import {
  Settings as SettingsIcon, Clock, Download, Upload, Shield,
  AlertTriangle, Lock, Eye, EyeOff, FileText, Key, Moon, Sun,
  Database, Save
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { importFromCSV } from '@/utils/importer';
import { evaluatePasswordStrength } from '@/utils/crypto';
import { validateMasterPassword } from '@/utils/policy';
import { logger } from '@/utils/logger';

export default function Settings() {
  const {
    autoLockMinutes, setAutoLockMinutes, changeMasterPassword,
    exportEncryptedBackup, exportCSV, setShowPrivacyPolicy,
    loading, error, setError, credentials, theme, setTheme,
    autoBackupEnabled, setAutoBackupEnabled, lastBackup, performAutoBackup,
    checkForUpdates, setCheckForUpdates,
  } = useVaultStore();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [backupInProgress, setBackupInProgress] = useState(false);

  const strength = evaluatePasswordStrength(newPassword);
  const policy = validateMasterPassword(newPassword);
  const canChange = oldPassword.length >= 1 && policy.valid && newPassword === confirmPassword && strength.score >= 2;

  const handleChangePassword = async () => {
    if (!canChange) return;
    setError(null);
    logger.info('Changing master password');
    await changeMasterPassword(oldPassword, newPassword);
    if (!error) {
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleExportEncrypted = async () => {
    setBackupInProgress(true);
    try {
      const data = await exportEncryptedBackup();
      downloadFile(data, `safevault-backup-${Date.now()}.json`, 'application/json');
      setExportMessage('✓ Encrypted backup downloaded');
      logger.info('Encrypted backup exported');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      logger.error('Export failed', err);
      setExportMessage('Failed to export backup.');
    }
    setBackupInProgress(false);
  };

  const handleExportCSV = () => {
    const data = exportCSV();
    downloadFile(data, `safevault-export-${Date.now()}.csv`, 'text/csv');
    setExportMessage('⚠️ CSV exported (plain text)');
    setTimeout(() => setExportMessage(''), 5000);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setExportMessage('Importing credentials...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const imported = importFromCSV(text);
        
        for (const cred of imported) {
          await useVaultStore.getState().addCredential(cred);
        }
        
        setExportMessage(`✓ Successfully imported ${imported.length} credentials!`);
        setTimeout(() => setExportMessage(''), 5000);
      } catch (err) {
        logger.error('Failed to import CSV', err);
        setExportMessage('Import failed. Check file format.');
        setTimeout(() => setExportMessage(''), 5000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleManualBackup = async () => {
    setBackupInProgress(true);
    await performAutoBackup();
    setExportMessage('✓ Local auto-backup saved');
    setTimeout(() => setExportMessage(''), 3000);
    setBackupInProgress(false);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto" role="region" aria-label="Settings">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-emerald-400" aria-hidden="true" />
        <h2 className="text-xl font-bold text-white">Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Vault Stats */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4" aria-hidden="true" /> Vault Statistics
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white" aria-label="Total entries">{credentials.length}</div>
              <div className="text-xs text-gray-500">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400" aria-label="Favorites count">{credentials.filter(c => c.favorite).length}</div>
              <div className="text-xs text-gray-500">Favorites</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400" aria-label="2FA enabled count">{credentials.filter(c => c.totpSecret).length}</div>
              <div className="text-xs text-gray-500">With 2FA</div>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4" aria-hidden="true" /> : <Sun className="w-4 h-4" aria-hidden="true" />}
            Appearance
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                theme === 'dark'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10'
              }`}
            >
              <Moon className="w-4 h-4" aria-hidden="true" /> Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                theme === 'light'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10'
              }`}
            >
              <Sun className="w-4 h-4" aria-hidden="true" /> Light
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Theme preference is saved locally and persists across sessions.</p>
        </div>

        {/* Auto-Lock Timer */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" aria-hidden="true" /> Auto-Lock Timer
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Automatically lock the vault after a period of inactivity. Also locks on system sleep/hibernate.
          </p>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Auto-lock timeout">
            {[1, 5, 15, 30, 0].map(minutes => (
              <button
                key={minutes}
                onClick={() => setAutoLockMinutes(minutes)}
                role="radio"
                aria-checked={autoLockMinutes === minutes}
                aria-label={minutes === 0 ? 'Never auto-lock' : `${minutes} minutes`}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  autoLockMinutes === minutes
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10'
                }`}
              >
                {minutes === 0 ? 'Never' : `${minutes}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Backup */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" aria-hidden="true" /> Auto-Backup
          </h3>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-emerald-500"
              aria-label="Enable automatic encrypted backups to local storage"
            />
            <div className="flex-1">
              <div className="text-sm text-white">Enable auto-backup to local storage</div>
              <div className="text-xs text-gray-500 mt-1">
                Creates an encrypted snapshot in localStorage after each change. Never leaves your device.
              </div>
              {lastBackup && (
                <div className="text-xs text-emerald-400 mt-2">
                  Last backup: {new Date(lastBackup).toLocaleString()}
                </div>
              )}
            </div>
          </label>
          {autoBackupEnabled && (
            <button
              onClick={handleManualBackup}
              disabled={backupInProgress}
              className="mt-3 py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {backupInProgress ? 'Saving...' : 'Backup Now'}
            </button>
          )}
        </div>

        {/* Change Master Password */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4" aria-hidden="true" /> Master Password
          </h3>
          {!showChangePassword ? (
            <button
              onClick={() => setShowChangePassword(true)}
              className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-sm"
              aria-label="Open change master password form"
            >
              Change Master Password
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm pr-10"
                />
                <button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                aria-label="New password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
              />
              {newPassword.length > 0 && (
                <>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full"
                        style={{
                          backgroundColor: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  {policy.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400">{err}</p>
                  ))}
                </>
              )}
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
              />
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowChangePassword(false); setError(null); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-sm"
                  aria-label="Cancel password change"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={!canChange || loading}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  aria-label="Save new password"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Changing password" />
                  ) : 'Change Password'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Export / Backup */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" aria-hidden="true" /> Export & Backup
          </h3>
          <div className="space-y-3">
            <button
              onClick={handleExportEncrypted}
              disabled={backupInProgress}
              className="w-full py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
              aria-label="Export encrypted backup"
            >
              {backupInProgress ? (
                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" role="status" aria-hidden="true" />
              ) : (
                <Upload className="w-4 h-4" aria-hidden="true" />
              )}
              Export Encrypted Backup (.json)
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full py-2.5 px-4 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-xl transition-colors text-sm flex items-center gap-2"
              aria-label="Export as CSV plain text"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Export as CSV (⚠️ Plain Text)
            </button>
            <div className="relative">
              <input
                type="file"
                id="import-csv-input"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <button
                onClick={() => document.getElementById('import-csv-input')?.click()}
                className="w-full py-2.5 px-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl transition-colors text-sm flex items-center gap-2"
                aria-label="Import credentials from CSV"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Import Credentials (CSV)
              </button>
            </div>
            <div className="flex gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-300/80">
                CSV import supports Bitwarden, ProtonPass, Brave, DuckDuckGo, and 40+ other standard formats.
              </p>
            </div>
            {exportMessage && (
              <p className="text-xs text-emerald-400 text-center py-1" role="status" aria-live="polite">{exportMessage}</p>
            )}
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Shield className="w-4 h-4" aria-hidden="true" /> Privacy & Security
          </h3>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-gray-200">Check for Updates (Optional)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Query GitHub API on startup to detect newer releases. Disabled by default to ensure 100% offline privacy.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={checkForUpdates}
                onChange={(e) => setCheckForUpdates(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
            </label>
          </div>
          <button
            onClick={() => setShowPrivacyPolicy(true)}
            className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-sm text-left"
            aria-label="Open privacy policy"
          >
            View Privacy Policy
          </button>
        </div>

        {/* App Info */}
        <div className="text-center py-4 text-xs text-gray-600 space-y-1" role="contentinfo">
          <p>SafeVault v1.1.0 — Zero-Knowledge Credential Manager</p>
          <p>All data encrypted locally · No telemetry · No tracking</p>
          <p className="text-gray-700">AES-GCM 256-bit · PBKDF2 600K iterations · SHA-512</p>
        </div>
      </div>
    </div>
  );
}
