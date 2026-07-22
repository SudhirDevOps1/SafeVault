import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, Unlock, FileUp, AlertTriangle, Download } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { logger } from '@/utils/logger';

export default function VaultUnlock() {
  const { unlockVault, importEncryptedBackup, loading, error, setError } = useVaultStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [unlockProgress, setUnlockProgress] = useState(false);

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setError(null);
    setUnlockProgress(true);
    logger.info('Attempting to unlock vault');
    await unlockVault(password);
    setUnlockProgress(false);
  };

  const handleImport = async () => {
    if (!importData.trim() || !importPassword.trim()) return;
    logger.info('Importing encrypted backup');
    await importEncryptedBackup(importData, importPassword);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('Backup file is too large (>50MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportData(ev.target?.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read backup file.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-4" role="img" aria-label="SafeVault shield logo">
            <Shield className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SafeVault</h1>
          <p className="text-gray-400">Enter your master password to unlock</p>
        </div>

        {!showImport ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Vault unlock form">
            <div className="space-y-5">
              <div>
                <label htmlFor="unlock-password" className="block text-sm font-medium text-gray-300 mb-2">
                  Master Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden="true" />
                  <input
                    id="unlock-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter master password..."
                    aria-label="Master password"
                    autoComplete="current-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {unlockProgress && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl" role="status" aria-live="polite">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" aria-hidden="true" />
                    <p className="text-xs text-emerald-400">Deriving encryption key (600K iterations)...</p>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">This may take a few seconds on slower devices</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2" role="alert" aria-live="assertive">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleUnlock}
                disabled={!password.trim() || loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                aria-label="Unlock vault"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Unlocking vault" />
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" aria-hidden="true" />
                    <span>Unlock Vault</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowImport(true)}
                  className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-200 flex items-center justify-center gap-2 transition-colors"
                  aria-label="Import from backup"
                >
                  <FileUp className="w-4 h-4" aria-hidden="true" />
                  Import from Backup
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Import backup form">
            <h3 className="text-lg font-semibold text-white mb-4">Import Encrypted Backup</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Backup File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  aria-label="Select backup file"
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="backup-password" className="block text-sm font-medium text-gray-300 mb-2">
                  Backup Password
                </label>
                <input
                  id="backup-password"
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter backup password..."
                  aria-label="Backup password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImport(false); setError(null); }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
                  aria-label="Cancel import"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importData || !importPassword || loading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  aria-label="Import backup"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Importing" />
                  ) : (
                    <span>Import</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-6">
          All data is encrypted locally. Nothing leaves your device.
        </p>

        {/* Desktop App Download Options (Web Only) */}
        {!(typeof window !== 'undefined' && 'electron' in window) && (
          <div className="mt-8 p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Download Desktop Apps</span>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">For offline access, global shortcuts, and CLI loop wizard.</p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href="https://github.com/SudhirDevOps1/SafeVault/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white rounded-lg text-xs font-medium transition-all"
              >
                Windows
              </a>
              <a
                href="https://github.com/SudhirDevOps1/SafeVault/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white rounded-lg text-xs font-medium transition-all"
              >
                macOS
              </a>
              <a
                href="https://github.com/SudhirDevOps1/SafeVault/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white rounded-lg text-xs font-medium transition-all"
              >
                Linux
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
