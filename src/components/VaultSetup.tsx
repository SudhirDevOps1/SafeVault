import { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, AlertTriangle, Check, X, Download } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { evaluatePasswordStrength } from '@/utils/crypto';
import { validateMasterPassword } from '@/utils/policy';
import { logger } from '@/utils/logger';

export default function VaultSetup() {
  const { createVault, loading, error, setError } = useVaultStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = evaluatePasswordStrength(password);
  const policy = validateMasterPassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canCreate = passwordsMatch && policy.valid && strength.score >= 2;

  const handleCreate = async () => {
    if (!canCreate) {
      if (!policy.valid) {
        setError('Master password does not meet security requirements.');
      } else if (!passwordsMatch) {
        setError('Passwords do not match.');
      } else {
        setError('Please choose a stronger password.');
      }
      return;
    }
    setError(null);
    logger.info('Creating new vault');
    await createVault(password);
    logger.info('Vault created successfully');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-4" role="img" aria-label="SafeVault shield logo">
            <ShieldCheck className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SafeVault</h1>
          <p className="text-gray-400">Create your secure, encrypted vault</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Vault setup form">
          <div className="space-y-5">
            <div>
              <label htmlFor="master-password" className="block text-sm font-medium text-gray-300 mb-2">
                Master Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden="true" />
                <input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password..."
                  aria-label="Master password"
                  aria-describedby="password-strength"
                  autoComplete="new-password"
                  className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
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

              {password.length > 0 && (
                <div id="password-strength" className="mt-3" aria-live="polite">
                  <div className="flex gap-1 mb-1.5" role="progressbar" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={4} aria-label={`Password strength: ${strength.label}`}>
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>
                    {strength.label}
                  </p>

                  {/* Policy checklist */}
                  <ul className="mt-3 space-y-1 text-xs" aria-label="Password requirements">
                    <li className="flex items-center gap-1.5">
                      {password.length >= 8 ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <X className="w-3 h-3 text-gray-500" aria-hidden="true" />}
                      <span className={password.length >= 8 ? 'text-emerald-400' : 'text-gray-500'}>At least 8 characters</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      {/[a-z]/.test(password) && /[A-Z]/.test(password) ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <X className="w-3 h-3 text-gray-500" aria-hidden="true" />}
                      <span className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'text-emerald-400' : 'text-gray-500'}>Mixed case letters</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      {/[0-9]/.test(password) ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <X className="w-3 h-3 text-gray-500" aria-hidden="true" />}
                      <span className={/[0-9]/.test(password) ? 'text-emerald-400' : 'text-gray-500'}>Contains numbers</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      {!/^[a-zA-Z0-9]+$/.test(password) && password.length > 0 ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <X className="w-3 h-3 text-gray-500" aria-hidden="true" />}
                      <span className={!/^[a-zA-Z0-9]+$/.test(password) && password.length > 0 ? 'text-emerald-400' : 'text-gray-500'}>Contains symbols</span>
                    </li>
                  </ul>

                  {policy.errors.length > 0 && (
                    <div className="mt-2 space-y-0.5" role="alert">
                      {policy.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" /> {err}
                        </p>
                      ))}
                    </div>
                  )}
                  {policy.warnings.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {policy.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400">{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm master password..."
                  aria-label="Confirm password"
                  autoComplete="new-password"
                  className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1.5" role="alert">Passwords do not match</p>
              )}
            </div>

            <div className="flex gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-300/80">
                Your master password cannot be recovered. If you forget it, all vault data will be permanently inaccessible.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert" aria-live="assertive">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!canCreate || loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              aria-label="Create secure vault"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Creating vault" />
                  <span>Creating Vault...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                  <span>Create Secure Vault</span>
                </>
              )}
            </button>
          </div>
        </div>

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
