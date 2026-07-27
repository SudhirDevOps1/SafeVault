import { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, AlertTriangle, Check, X, Clipboard, ArrowRight, ArrowLeft } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { evaluatePasswordStrength } from '@/utils/crypto';
import { validateMasterPassword } from '@/utils/policy';
import { generateMnemonic } from '@/utils/bip39';
import { logger } from '@/utils/logger';
import WebShowcase from './WebShowcase';

export default function VaultSetup() {
  const { createVault, loading, error, setError } = useVaultStore();
  const [step, setStep] = useState<'password' | 'recovery' | 'confirm_recovery'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [typedRecoveryPhrase, setTypedRecoveryPhrase] = useState('');
  const [copied, setCopied] = useState(false);

  const strength = evaluatePasswordStrength(password);
  const policy = validateMasterPassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canContinue = passwordsMatch && policy.valid && strength.score >= 2;

  const handlePasswordSubmit = () => {
    if (!canContinue) {
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
    const mnemonic = generateMnemonic();
    setRecoveryPhrase(mnemonic);
    setStep('recovery');
  };

  const handleCopyRecovery = () => {
    navigator.clipboard.writeText(recoveryPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    logger.info('Recovery phrase copied to clipboard');
  };

  const handleFinalSubmit = async () => {
    const cleanTyped = typedRecoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanRecovery = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    
    if (cleanTyped !== cleanRecovery) {
      setError('The recovery phrase you typed does not match. Please verify and try again.');
      return;
    }
    
    setError(null);
    logger.info('Creating new vault with Argon2id and recovery wrapped key');
    await createVault(password, recoveryPhrase);
  };

  const isElectron = typeof window !== 'undefined' && 'electron' in window;
  const isExtension = typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id;
  const isMobile = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const showShowcase = !isElectron && !isExtension && !isMobile;

  const renderFormStep = () => {
    if (step === 'password') {
      return (
        <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl" role="form" aria-label="Vault setup password step">
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

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canContinue}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Next: Generate Recovery Phrase</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      );
    }

    if (step === 'recovery') {
      return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Your Emergency Recovery Phrase</p>
              <p className="mt-0.5 text-gray-400">Write down these 24 words in order and store them in a secure physical location. It allows you to recover your vault if you lose your password.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-black/30 p-4 border border-white/5 rounded-xl font-mono text-xs">
            {recoveryPhrase.split(' ').map((word, i) => (
              <div key={i} className="flex gap-1.5 py-1 px-1.5 bg-white/5 rounded border border-white/5">
                <span className="text-gray-500 text-[10px] w-4 text-right">{i + 1}.</span>
                <span className="text-emerald-300 font-semibold">{word}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyRecovery}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 text-xs"
            >
              <Clipboard className="w-4 h-4" />
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex justify-between gap-4">
            <button
              onClick={() => setStep('password')}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-colors flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => { setError(null); setStep('confirm_recovery'); }}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-1.5 text-xs"
            >
              <span>Next: Verify Mnemonic</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Recovery Phrase
          </label>
          <p className="text-xs text-gray-400 mb-3">To verify you have saved your recovery phrase, please paste or type it in order (24 words, space separated):</p>
          <textarea
            value={typedRecoveryPhrase}
            onChange={(e) => setTypedRecoveryPhrase(e.target.value)}
            placeholder="Type or paste your 24 words here..."
            className="w-full h-28 p-3 bg-black/30 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="pt-2 border-t border-white/10 flex justify-between gap-4">
          <button
            onClick={() => { setError(null); setStep('recovery'); }}
            disabled={loading}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-colors flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={handleFinalSubmit}
            disabled={loading || !typedRecoveryPhrase.trim()}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-1.5 text-xs"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Vault...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Create Vault</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const formContent = (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-4" role="img" aria-label="SafeVault shield logo">
          <ShieldCheck className="w-10 h-10 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">SafeVault</h1>
        <p className="text-gray-400">
          {step === 'password' && 'Create your secure, encrypted vault'}
          {step === 'recovery' && 'Write Down Recovery Phrase'}
          {step === 'confirm_recovery' && 'Verify Recovery Phrase'}
        </p>
      </div>

      {renderFormStep()}

      <p className="text-center text-xs text-gray-600 mt-6">
        All encryption key derivation runs locally. Zero data telemetry.
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
