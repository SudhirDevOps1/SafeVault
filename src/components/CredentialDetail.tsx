import { useState, useEffect } from 'react';
import {
  Copy, Check, Eye, EyeOff, Edit, Trash2, Globe, User,
  Lock, FileText, Star, ExternalLink, ArrowLeft, Key,
  CreditCard, Wifi
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { useClipboard } from '@/hooks/useClipboard';
import TOTPDisplay from './TOTPDisplay';
import CredentialForm from './CredentialForm';
import type { Credential } from '@/types';

interface CredentialDetailProps {
  credential: Credential;
}

export default function CredentialDetail({ credential }: CredentialDetailProps) {
  const { deleteCredential, updateCredential, setSelectedCredential, networkApprovedThisSession, disableRemoteFavicons, honeypotCredentialId, setHoneypotCredential, addAuditLog } = useVaultStore();
  const { copiedField, copyToClipboard } = useClipboard();
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCardCVV, setShowCardCVV] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [honeypotAlert, setHoneypotAlert] = useState(false);

  const isHoneypot = honeypotCredentialId === credential.id;

  // Intercept password copy for honeypot alert
  const handlePasswordCopy = (text: string, field: string) => {
    if (isHoneypot && field === 'password') {
      setHoneypotAlert(true);
      addAuditLog('HONEYPOT_TRIGGERED', `⚠️ Honeypot credential "${credential.title}" password was accessed/copied`);
      setTimeout(() => setHoneypotAlert(false), 6000);
    }
    copyToClipboard(text, field);
  };

  // Reset imageError when current credential changes
  useEffect(() => {
    setImageError(false);
  }, [credential.id]);

  const handleDelete = async () => {
    await deleteCredential(credential.id);
    setSelectedCredential(null);
  };

  const toggleFavorite = async () => {
    await updateCredential(credential.id, { favorite: !credential.favorite });
  };

  const getFavicon = (url: string) => {
    if (disableRemoteFavicons) return null;
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    } catch {
      return null;
    }
  };

  const favicon = (credential.url && networkApprovedThisSession) ? getFavicon(credential.url) : null;

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => handlePasswordCopy(text, field)}
      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-500" />
      )}
    </button>
  );

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/5">
          <button
            onClick={() => setSelectedCredential(null)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-4 md:hidden transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                {(favicon && !imageError) ? (
                  <img src={favicon} alt="" className="w-7 h-7" onError={() => setImageError(true)} />
                ) : (
                  <Globe className="w-6 h-6 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{credential.title}</h2>
                  {credential.category === 'Alias' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Email Alias
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const status = credential.aliasStatus || 'active';
                          const next = status === 'active' ? 'paused' : status === 'paused' ? 'blocked' : 'active';
                          await updateCredential(credential.id, { aliasStatus: next });
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border transition-all cursor-pointer ${
                          (credential.aliasStatus || 'active') === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : (credential.aliasStatus === 'paused')
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                        title="Click to cycle status (Active -> Paused -> Blocked)"
                      >
                        {credential.aliasStatus === 'paused' ? '🟡 Paused' : credential.aliasStatus === 'blocked' ? '🔴 Blocked' : '🟢 Active'}
                      </button>
                    </div>
                  )}
                  {isHoneypot && (
                    <span className="text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider" title="This credential is marked as a honeypot/decoy">
                      🎯 Honeypot
                    </span>
                  )}
                </div>
                {credential.url && (
                  <a
                    href={credential.url.startsWith('http') ? credential.url : `https://${credential.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {credential.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {typeof window !== 'undefined' && 'chrome' in window && (window as any).chrome?.tabs && (
                <button
                  onClick={() => {
                    const chrome = (window as any).chrome;
                    if (!chrome?.tabs?.query) return;
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                      if (chrome.runtime?.lastError || !tabs?.[0]?.id) return;
                      try {
                        const p = chrome.tabs.sendMessage(tabs[0].id, {
                          action: "autofillCredentials",
                          username: credential.username || '',
                          password: credential.password || ''
                        }, () => {
                          if (chrome.runtime?.lastError) return;
                          addAuditLog('AUTOFILL_TRIGGERED', `⚡ Autofilled credentials for "${credential.title}"`);
                        });
                        if (p && typeof p.catch === 'function') {
                          p.catch(() => {});
                        }
                      } catch {}
                    });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-all mr-1"
                  title="Autofill this site"
                >
                  ⚡ Autofill
                </button>
              )}
              <button
                onClick={() => setHoneypotCredential(isHoneypot ? null : credential.id)}
                className={`p-2 rounded-lg transition-colors text-xs ${isHoneypot ? 'text-amber-400 hover:bg-amber-500/10' : 'text-gray-500 hover:bg-white/10'}`}
                title={isHoneypot ? 'Remove honeypot marker' : 'Mark as Honeypot/Decoy — triggers alert if accessed'}
              >
                🎯
              </button>
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg transition-colors ${credential.favorite ? 'text-amber-400 hover:bg-amber-500/10' : 'text-gray-500 hover:bg-white/10'}`}
                title={credential.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-5 h-5 ${credential.favorite ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Edit"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Honeypot Alert Banner */}
          {honeypotAlert && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 animate-pulse">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-bold text-rose-400">Honeypot Triggered!</p>
                <p className="text-xs text-rose-300/70 mt-0.5">This credential is marked as a decoy. This access has been logged to your local audit log.</p>
              </div>
            </div>
          )}

          {/* Visual Payment Card (if Cards category or cardNumber exists) */}
          {(credential.category === 'Cards' || credential.cardNumber) && (
            <div className="space-y-4">
              <div className="w-full max-w-sm mx-auto aspect-[1.586/1] rounded-2xl p-5 bg-gradient-to-tr from-slate-900 via-zinc-900 to-neutral-800 border border-white/20 shadow-2xl relative flex flex-col justify-between overflow-hidden">
                {/* Glossy overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none" />

                {/* Card Top: Chip, Contactless & Brand Badge */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    {/* Metallic EMV Chip */}
                    <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow flex flex-col justify-around p-1">
                      <div className="w-full h-0.5 bg-amber-800/40 rounded-full" />
                      <div className="w-full h-0.5 bg-amber-800/40 rounded-full" />
                    </div>
                    {/* Contactless Wave */}
                    <Wifi className="w-4 h-4 text-gray-300 rotate-90 opacity-75" />
                  </div>

                  {/* Brand Badge */}
                  <span className="font-black text-xs tracking-widest uppercase px-2.5 py-0.5 bg-white/10 rounded-md text-white border border-white/20 backdrop-blur-sm">
                    {credential.cardType?.toUpperCase() || 'CARD'}
                  </span>
                </div>

                {/* Card Middle: Card Number */}
                <div className="my-auto relative z-10 flex items-center justify-between">
                  <span className="font-mono text-lg sm:text-xl font-bold tracking-[0.2em] text-white drop-shadow">
                    {showCardNumber
                      ? (credential.cardNumber ? credential.cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••')
                      : (credential.cardNumber
                          ? `•••• •••• •••• ${credential.cardNumber.replace(/\D/g, '').slice(-4) || '••••'}`
                          : '•••• •••• •••• ••••')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCardNumber(!showCardNumber)}
                      className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                      title={showCardNumber ? 'Hide card number' : 'Reveal card number'}
                    >
                      {showCardNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {credential.cardNumber && (
                      <CopyButton text={credential.cardNumber.replace(/\D/g, '')} field="cardNumber" />
                    )}
                  </div>
                </div>

                {/* Card Bottom: Holder, Expiry & CVV */}
                <div className="flex items-end justify-between relative z-10 text-xs">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">Cardholder</span>
                    <span className="font-mono font-bold tracking-wider text-white uppercase text-xs truncate max-w-[130px] block">
                      {credential.cardHolder || credential.username || 'VALUED CARDHOLDER'}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">Expires</span>
                    <span className="font-mono font-bold tracking-widest text-white text-xs block">
                      {credential.cardExpiry || 'MM/YY'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 block font-semibold">CVV</span>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="font-mono font-bold tracking-widest text-white text-xs">
                        {showCardCVV ? (credential.cardCVV || '•••') : '•••'}
                      </span>
                      {credential.cardCVV && (
                        <button
                          type="button"
                          onClick={() => setShowCardCVV(!showCardCVV)}
                          className="p-0.5 text-gray-400 hover:text-white transition-colors"
                        >
                          {showCardCVV ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Detail Fields Grid */}
              <div className="grid grid-cols-2 gap-3">
                {credential.cardNumber && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Card Number</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-mono text-sm">
                        {showCardNumber ? credential.cardNumber : `•••• •••• •••• ${credential.cardNumber.replace(/\D/g, '').slice(-4) || '••••'}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowCardNumber(!showCardNumber)}
                          className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300"
                        >
                          {showCardNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <CopyButton text={credential.cardNumber.replace(/\D/g, '')} field="cardNumberField" />
                      </div>
                    </div>
                  </div>
                )}

                {credential.cardExpiry && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide block mb-1">Expiry Date</span>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-mono text-sm">{credential.cardExpiry}</span>
                      <CopyButton text={credential.cardExpiry} field="cardExpiry" />
                    </div>
                  </div>
                )}

                {credential.cardCVV && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide block mb-1">Security Code (CVV)</span>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-mono text-sm">{showCardCVV ? credential.cardCVV : '•••'}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowCardCVV(!showCardCVV)}
                          className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300"
                        >
                          {showCardCVV ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <CopyButton text={credential.cardCVV} field="cardCVV" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Username */}
          {credential.username && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Username</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-sm">{credential.username}</span>
                <CopyButton text={credential.username} field="username" />
              </div>
            </div>
          )}

          {/* Password */}
          {credential.password && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Lock className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Password</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-sm">
                  {showPassword ? credential.password : '•'.repeat(Math.min(credential.password.length, 24))}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    title={showPassword ? 'Hide' : 'Reveal'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  <CopyButton text={credential.password} field="password" />
                </div>
              </div>
            </div>
          )}

          {/* TOTP */}
          {credential.totpSecret && (
            <div>
              <TOTPDisplay secret={credential.totpSecret} />
              <div className="mt-2 bg-white/5 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Key className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">TOTP Secret</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white font-mono text-sm">
                    {showTotpSecret ? credential.totpSecret : '•'.repeat(16)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setShowTotpSecret(!showTotpSecret)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {showTotpSecret ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    <CopyButton text={credential.totpSecret} field="totpSecret" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {credential.notes && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {credential.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            <span>Category: {credential.category}</span>
            <span>Created: {new Date(credential.createdAt).toLocaleDateString()}</span>
            <span>Modified: {new Date(credential.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Clipboard notice */}
        {copiedField && (
          <div className="px-6 py-3 bg-emerald-500/10 border-t border-emerald-500/20">
            <p className="text-xs text-emerald-400 text-center">
              ✓ Copied to clipboard · Will auto-clear in 30 seconds
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <Trash2 className="w-10 h-10 text-red-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Delete Credential?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete "<span className="text-white">{credential.title}</span>"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <CredentialForm credential={credential} onClose={() => setIsEditing(false)} />
      )}
    </>
  );
}
