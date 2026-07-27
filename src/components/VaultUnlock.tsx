import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, Unlock, FileUp, AlertTriangle } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { db } from '@/utils/db';
import { logger } from '@/utils/logger';

import WebShowcase from './WebShowcase';

export default function VaultUnlock() {
  const { 
    unlockVault, 
    unlockVaultWithRecovery, 
    importEncryptedBackup, 
    loading, 
    error, 
    setError,
    isPinUnlockEnabled,
    pinAttemptsLeft,
    unlockWithPin
  } = useVaultStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [importData, setImportData] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [unlockProgress, setUnlockProgress] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [unlockMode, setUnlockMode] = useState<'password' | 'pin'>(isPinUnlockEnabled ? 'pin' : 'password');

  const handleResetVault = async () => {
    if (resetInput !== 'RESET') {
      alert('Please type "RESET" to confirm.');
      return;
    }
    try {
      // Clear all IndexedDB tables (SafeVault only has vault store)
      await db.vault.clear();
      // Clear local storage (wipes deleted credentials list, last sync info, theme, etc.)
      localStorage.clear();
      // Reload page to return to setup state
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset vault', err);
    }
  };

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setError(null);
    setUnlockProgress(true);
    logger.info('Attempting to unlock vault');
    await unlockVault(password);
    setUnlockProgress(false);
  };

  const handlePinUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.length < 4) return;
    setError(null);
    logger.info('Attempting to unlock vault with PIN');
    const success = await unlockWithPin(pinInput);
    if (!success) {
      setPinInput(''); // Clear on failure
    }
  };

  const handleRecoveryUnlock = async () => {
    if (!recoveryPhrase.trim()) return;
    setError(null);
    logger.info('Attempting to unlock vault with recovery phrase');
    await unlockVaultWithRecovery(recoveryPhrase);
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

  const isElectron = typeof window !== 'undefined' && 'electron' in window;
  const isExtension = typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id;
  const isMobile = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const showShowcase = !isElectron && !isExtension && !isMobile;

  const renderUnlockView = () => {
    if (showImport) {
      return (
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
      );
    }

    if (showRecovery) {
      return (
        <form onSubmit={(e) => { e.preventDefault(); handleRecoveryUnlock(); }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Recovery phrase unlock form">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>Unlock using Recovery Phrase</span>
            </h3>
            
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                Enter your 24-word recovery phrase in order (space separated):
              </label>
              <textarea
                value={recoveryPhrase}
                onChange={(e) => setRecoveryPhrase(e.target.value)}
                placeholder="Type or paste your 24 words here..."
                aria-label="Recovery phrase"
                className="w-full h-28 p-3 bg-black/30 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2" role="alert" aria-live="assertive">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowRecovery(false); setError(null); }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!recoveryPhrase.trim() || loading}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Verify & Unlock</span>
                )}
              </button>
            </div>
          </div>
        </form>
      );
    }

    if (showResetConfirm) {
      return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-rose-500 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Reset Vault
          </h3>
          <p className="text-xs text-gray-400 leading-normal">
            Warning: This action will permanently delete all stored credentials and configurations on this device. 
            This cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="text-xs text-gray-400 block">Type "RESET" to confirm deletion:</label>
            <input
              type="text"
              value={resetInput}
              onChange={e => setResetInput(e.target.value)}
              placeholder="RESET"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-rose-400 font-bold focus:outline-none focus:border-rose-500/30 transition-all font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-all border border-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResetVault}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      );
    }

    if (unlockMode === 'pin' && isPinUnlockEnabled) {
      return (
        <form onSubmit={handlePinUnlock} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="PIN unlock form">
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <label htmlFor="unlock-pin" className="block text-sm font-semibold text-gray-300">
                Enter Quick PIN
              </label>
              <p className="text-[10px] text-gray-500">Fast, local E2EE session unlock</p>
            </div>
            
            {pinAttemptsLeft < 3 && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-400">
                ⚠️ {pinAttemptsLeft} PIN unlock attempt(s) remaining before lockout database reset.
              </div>
            )}
            
            <div className="flex justify-center gap-3 py-2">
              <input
                id="unlock-pin"
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPinInput(val);
                  if (val.length === 6) {
                    setError(null);
                    unlockWithPin(val).then(success => {
                      if (!success) setPinInput('');
                    });
                  }
                }}
                placeholder="••••••"
                autoComplete="off"
                autoFocus
                className="w-36 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-center text-2xl font-bold tracking-widest font-mono"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={pinInput.length < 4 || loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-xs"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <span>Unlock Vault</span>
              )}
            </button>

            <div className="pt-2 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => { setError(null); setUnlockMode('password'); }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Use Master Password instead
              </button>
            </div>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Vault unlock form">
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
                <p className="text-xs text-emerald-400">Deriving encryption key (Argon2id WASM)...</p>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 font-mono">OWASP 2026 memory-hard protection</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2" role="alert" aria-live="assertive">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
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

          <div className="pt-2 border-t border-white/5 flex gap-2 justify-between">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex-1 py-2 text-xs text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1.5 transition-colors border border-white/5 rounded-lg bg-white/5"
            >
              <FileUp className="w-3.5 h-3.5" />
              Import Backup
            </button>
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="flex-1 py-2 text-xs text-emerald-400/80 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/10 rounded-lg bg-emerald-500/5"
            >
              <Lock className="w-3.5 h-3.5" />
              Use Mnemonic Phrase
            </button>
          </div>
          
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setShowResetConfirm(true); setResetInput(''); }}
              className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors"
            >
              Forgot Master Password? Reset Vault
            </button>
          </div>
        </div>
      </form>
    );
  };

  const formContent = (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-4" role="img" aria-label="SafeVault shield logo">
          <Shield className="w-10 h-10 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">SafeVault</h1>
        <p className="text-gray-400">
          {showImport && 'Import your encrypted backup file'}
          {showRecovery && 'Verify your emergency mnemonic'}
          {!showImport && !showRecovery && (unlockMode === 'pin' ? 'Enter your quick PIN to unlock' : 'Enter your master password to unlock')}
        </p>
        {!showImport && !showRecovery && isPinUnlockEnabled && unlockMode === 'password' && (
          <button
            type="button"
            onClick={() => { setError(null); setUnlockMode('pin'); }}
            className="mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Switch to Quick PIN Unlock
          </button>
        )}
      </div>

      {renderUnlockView()}

      <p className="text-center text-xs text-gray-600 mt-6">
        All keys are derived locally. Zero data leaves your device.
      </p>
    </div>
  );

  if (showShowcase) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-950 text-white">
        {/* Left Side: Showcase */}
        <div className="w-full md:w-[55%] flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto max-h-screen">
          <WebShowcase />
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-[45%] flex items-center justify-center p-6 md:p-12 overflow-y-auto max-h-screen bg-gray-950">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      {formContent}
    </div>
  );
}
