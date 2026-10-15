import { useState } from 'react';
import {
  Copy, Check, Eye, EyeOff, Trash2, User,
  Lock, FileText, Star, ExternalLink, ArrowLeft, Key,
  CreditCard, Edit3, MoreVertical, Shield, Zap, Globe
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { useClipboard } from '@/hooks/useClipboard';
import TOTPDisplay from './TOTPDisplay';
import CredentialForm from './CredentialForm';
import ServiceLogo from './ServiceLogo';
import type { Credential } from '@/types';
import { autofillActiveTab } from '@/utils/extensionAutofill';
import { evaluatePasswordStrength } from '@/utils/crypto';

interface CredentialDetailProps {
  credential: Credential;
}

export default function CredentialDetail({ credential }: CredentialDetailProps) {
  const {
    deleteCredential, updateCredential, setSelectedCredential,
    honeypotCredentialId, setHoneypotCredential, addAuditLog
  } = useVaultStore();
  const { copiedField, copyToClipboard } = useClipboard();

  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCardCVV, setShowCardCVV] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [honeypotAlert, setHoneypotAlert] = useState(false);
  const [autofillSuccess, setAutofillSuccess] = useState(false);

  const isHoneypot = honeypotCredentialId === credential.id;
  const isExtension = typeof window !== 'undefined' && !!(window as any).chrome?.runtime?.id;
  const passStrength = credential.password ? evaluatePasswordStrength(credential.password) : null;

  // Intercept password copy for honeypot alert
  const handlePasswordCopy = (text: string, field: string) => {
    if (isHoneypot && field === 'password') {
      setHoneypotAlert(true);
      addAuditLog('HONEYPOT_TRIGGERED', `⚠️ Honeypot credential "${credential.title}" password was accessed/copied`);
      setTimeout(() => setHoneypotAlert(false), 6000);
    }
    copyToClipboard(text, field);
  };

  const handleDelete = async () => {
    await deleteCredential(credential.id);
    setSelectedCredential(null);
  };

  const toggleFavorite = async () => {
    await updateCredential(credential.id, { favorite: !credential.favorite });
  };

  const handleAutofill = async () => {
    const success = await autofillActiveTab({
      username: credential.username || '',
      password: credential.password || ''
    });
    if (success) {
      setAutofillSuccess(true);
      addAuditLog('AUTOFILL_TRIGGERED', `⚡ Autofilled credentials for "${credential.title}"`);
      setTimeout(() => setAutofillSuccess(false), 2500);
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => handlePasswordCopy(text, field)}
      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
      )}
    </button>
  );

  return (
    <>
      <div className="h-full flex flex-col bg-slate-950/60 overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
          {/* Back button on mobile / small screens */}
          <button
            onClick={() => setSelectedCredential(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 mb-3 md:hidden transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Vault</span>
          </button>

          <div className="flex items-center justify-between gap-3">
            {/* Left: Brand Logo & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <ServiceLogo
                url={credential.url}
                title={credential.title}
                category={credential.category}
                customIcon={credential.customIcon}
                customColor={credential.customColor}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white truncate">{credential.title}</h2>
                  {credential.category === 'Alias' && (
                    <span className="text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      Alias
                    </span>
                  )}
                  {isHoneypot && (
                    <span className="text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">
                      🎯 Decoy
                    </span>
                  )}
                </div>
                {credential.url && (
                  <span className="text-xs text-gray-400 truncate block mt-0.5">
                    {credential.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Unmistakable Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Prominent Edit Button (Proton Pass Style) */}
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Edit this credential"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              {/* Quick Autofill in extension */}
              {isExtension && (
                <button
                  onClick={handleAutofill}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all cursor-pointer ${
                    autofillSuccess
                      ? 'bg-emerald-500 text-slate-950 font-extrabold'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title="Autofill this login on active tab"
                >
                  {autofillSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Filled</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Autofill</span>
                    </>
                  )}
                </button>
              )}

              {/* More Actions Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMoreMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50 text-xs text-gray-200 backdrop-blur-lg"
                    onClick={() => setShowMoreMenu(false)}
                  >
                    <button
                      onClick={toggleFavorite}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Star className={`w-4 h-4 ${credential.favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
                      <span>{credential.favorite ? 'Remove Favorite' : 'Mark as Favorite'}</span>
                    </button>

                    <button
                      onClick={() => setHoneypotCredential(isHoneypot ? null : credential.id)}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Shield className={`w-4 h-4 ${isHoneypot ? 'text-amber-400' : 'text-gray-400'}`} />
                      <span>{isHoneypot ? 'Remove Decoy Marker' : 'Mark as Decoy/Honeypot'}</span>
                    </button>

                    <button
                      onClick={() => {
                        const copyStr = `Title: ${credential.title}\nUsername: ${credential.username}\nPassword: ${credential.password}\nURL: ${credential.url}`;
                        copyToClipboard(copyStr, 'all');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                      <span>Copy All Fields</span>
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full px-3 py-2 text-left hover:bg-rose-500/15 text-rose-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Delete Login</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Content Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {/* Honeypot Alert Banner */}
          {honeypotAlert && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 animate-pulse">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-bold text-rose-400">Honeypot Triggered!</p>
                <p className="text-xs text-rose-300/70 mt-0.5">
                  This credential is a decoy trap. This unauthorized access was recorded in your local audit log.
                </p>
              </div>
            </div>
          )}

          {/* Card 1: Email / Username */}
          {credential.username && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 shadow-sm hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 mb-1.5 text-gray-400">
                <User className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {credential.username.includes('@') ? 'Email' : 'Username'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white font-mono font-medium text-sm sm:text-base select-all break-all">
                  {credential.username}
                </span>
                <CopyButton text={credential.username} field="username" />
              </div>
            </div>
          )}

          {/* Card 2: Password */}
          {credential.password && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 shadow-sm hover:border-white/10 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-gray-400">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Password</span>
                </div>
                {passStrength && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${passStrength.color}22`, color: passStrength.color }}
                  >
                    {passStrength.label}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white font-mono text-sm sm:text-base tracking-wider select-all break-all">
                  {showPassword ? credential.password : '••••••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <CopyButton text={credential.password} field="password" />
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Websites */}
          {credential.url && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 shadow-sm hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Websites</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <a
                  href={credential.url.startsWith('http') ? credential.url : `https://${credential.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-300 hover:text-emerald-200 text-xs font-mono transition-colors truncate max-w-full"
                >
                  <span className="truncate">{credential.url}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </a>
                <CopyButton text={credential.url} field="url" />
              </div>
            </div>
          )}

          {/* Card 4: 2FA TOTP Authenticator */}
          {credential.totpSecret && (
            <div className="space-y-2">
              <TOTPDisplay secret={credential.totpSecret} />
              <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5 text-gray-400">
                  <Key className="w-4 h-4 text-teal-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">2FA Secret Key</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white font-mono text-xs sm:text-sm tracking-wider select-all break-all">
                    {showTotpSecret ? credential.totpSecret : '••••••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowTotpSecret(!showTotpSecret)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showTotpSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <CopyButton text={credential.totpSecret} field="totpSecret" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 5: Payment Card Display (if applicable) */}
          {(credential.category === 'Cards' || credential.cardNumber) && (
            <div className="space-y-4">
              <div className="w-full max-w-sm mx-auto aspect-[1.586/1] rounded-2xl p-5 bg-gradient-to-tr from-slate-900 via-zinc-900 to-neutral-800 border border-white/20 shadow-2xl relative flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow flex flex-col justify-around p-1">
                    <div className="w-full h-0.5 bg-amber-800/40 rounded-full" />
                    <div className="w-full h-0.5 bg-amber-800/40 rounded-full" />
                  </div>
                  <CreditCard className="w-6 h-6 text-white/70" />
                </div>
                <div className="my-auto relative z-10 flex items-center justify-between">
                  <span className="font-mono text-lg sm:text-xl font-bold tracking-[0.2em] text-white">
                    {showCardNumber
                      ? (credential.cardNumber || '•••• •••• •••• ••••')
                      : (credential.cardNumber
                          ? `•••• •••• •••• ${credential.cardNumber.replace(/\D/g, '').slice(-4) || '••••'}`
                          : '•••• •••• •••• ••••')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCardNumber(!showCardNumber)}
                    className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white"
                  >
                    {showCardNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-end justify-between relative z-10 text-xs">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">Cardholder</span>
                    <span className="font-mono font-bold text-white uppercase text-xs truncate max-w-[130px] block">
                      {credential.cardHolder || credential.username || 'VALUED CARDHOLDER'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">Expires</span>
                    <span className="font-mono font-bold text-white text-xs block">
                      {credential.cardExpiry || 'MM/YY'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCardCVV(!showCardCVV)}
                    className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                    title="Toggle CVV visibility"
                  >
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">CVV</span>
                    <span className="font-mono font-bold text-white text-xs">
                      {showCardCVV ? (credential.cardCVV || '•••') : '•••'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card 6: Notes */}
          {credential.notes && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2 text-gray-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Notes</span>
                </div>
                <CopyButton text={credential.notes} field="notes" />
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed select-all">
                {credential.notes}
              </p>
            </div>
          )}

          {/* Activity / Metadata Footer */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500">
            <span>Category: <strong className="text-gray-400">{credential.category}</strong></span>
            <span>Created: <strong className="text-gray-400">{new Date(credential.createdAt).toLocaleDateString()}</strong></span>
            <span>Modified: <strong className="text-gray-400">{new Date(credential.updatedAt).toLocaleDateString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <Trash2 className="w-10 h-10 text-rose-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Delete Credential?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete "<span className="text-white font-medium">{credential.title}</span>"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Credential Modal */}
      {isEditing && (
        <CredentialForm credential={credential} onClose={() => setIsEditing(false)} />
      )}
    </>
  );
}
