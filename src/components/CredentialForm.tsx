import { useState, useEffect } from 'react';
import {
  X, Save, Eye, EyeOff, Globe, User, Lock, FileText,
  Key, Wand2, ChevronDown, ChevronUp, CreditCard
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import PasswordGenerator from './PasswordGenerator';
import type { Credential } from '@/types';

interface CredentialFormProps {
  credential?: Credential | null;
  onClose: () => void;
}

const CATEGORIES = ['Login', 'Email', 'Social', 'Finance', 'Work', 'Payment Card', 'Passkey', 'Other'];

export default function CredentialForm({ credential, onClose }: CredentialFormProps) {
  const { addCredential, updateCredential } = useVaultStore();
  const isEditing = !!credential;

  const [title, setTitle] = useState(credential?.title || '');
  const [url, setUrl] = useState(credential?.url || '');
  const [username, setUsername] = useState(credential?.username || '');
  const [password, setPassword] = useState(credential?.password || '');
  const [notes, setNotes] = useState(credential?.notes || '');
  const [totpSecret, setTotpSecret] = useState(credential?.totpSecret || '');
  const [category, setCategory] = useState(credential?.category || 'Login');
  const [favorite, setFavorite] = useState(credential?.favorite || false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [saving, setSaving] = useState(false);

  // Card specific state
  const [cardNumber, setCardNumber] = useState(credential?.cardNumber || '');
  const [cardHolder, setCardHolder] = useState(credential?.cardHolder || '');
  const [cardExpiry, setCardExpiry] = useState(credential?.cardExpiry || '');
  const [cardCVV, setCardCVV] = useState(credential?.cardCVV || '');
  const [cardType, setCardType] = useState<any>(credential?.cardType || 'other');
  const [showCVV, setShowCVV] = useState(false);

  // Passkey specific state
  const [passkeyId, setPasskeyId] = useState(credential?.passkeyId || '');
  const [passkeyRpId, setPasskeyRpId] = useState(credential?.passkeyRpId || '');
  const [passkeyUsername, setPasskeyUsername] = useState(credential?.passkeyUsername || '');
  const [passkeyPublicKey, setPasskeyPublicKey] = useState(credential?.passkeyPublicKey || '');

  useEffect(() => {
    if (credential?.totpSecret) setShowTotp(true);
  }, [credential]);

  // Auto-detect card type from number
  useEffect(() => {
    const num = cardNumber.replace(/\D/g, '');
    if (num.startsWith('4')) setCardType('visa');
    else if (/^5[1-5]/.test(num)) setCardType('mastercard');
    else if (/^3[47]/.test(num)) setCardType('amex');
    else if (/^6(?:011|5)/.test(num)) setCardType('discover');
    else if (/^6[0-9]/.test(num)) setCardType('rupay');
    else setCardType('other');
  }, [cardNumber]);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let extraData = {};
      if (category === 'Payment Card') {
        extraData = { cardNumber, cardHolder, cardExpiry, cardCVV, cardType };
      } else if (category === 'Passkey') {
        extraData = { passkeyId, passkeyRpId, passkeyUsername, passkeyPublicKey };
      }

      if (isEditing && credential) {
        await updateCredential(credential.id, {
          title, url, username, password, notes, totpSecret, category, favorite,
          ...extraData
        });
      } else {
        await addCredential({
          title, url, username, password, notes, totpSecret, category, favorite,
          ...extraData
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-form-title"
    >
      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 id="credential-form-title" className="text-lg font-bold text-white">
            {isEditing ? 'Edit Credential' : 'Add New Credential'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close form"
            type="button"
          >
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="cred-category" className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
              <select
                id="cred-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm appearance-none cursor-pointer"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-gray-900">{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFavorite(!favorite)}
                aria-pressed={favorite}
                aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  favorite
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                {favorite ? '★ Fav' : '☆ Fav'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cred-title" className="block text-sm font-medium text-gray-300 mb-1.5">
              Title * <span className="text-gray-500 font-normal">(required)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="cred-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={category === 'Payment Card' ? 'e.g., Personal Credit Card' : 'e.g., Gmail Account'}
                required
                aria-required="true"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
              />
            </div>
          </div>

          {category === 'Payment Card' ? (
            <div className="space-y-4 border-t border-white/5 pt-4">
              <div>
                <label htmlFor="card-number" className="block text-sm font-medium text-gray-300 mb-1.5">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="card-number"
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    placeholder="XXXX XXXX XXXX XXXX"
                    className="w-full pl-10 pr-16 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 uppercase">
                    {cardType}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="card-holder" className="block text-sm font-medium text-gray-300 mb-1.5">Cardholder Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="card-holder"
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="card-expiry" className="block text-sm font-medium text-gray-300 mb-1.5">Expiry Date</label>
                  <input
                    id="card-expiry"
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    placeholder="MM/YY"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono text-center"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="card-cvv" className="block text-sm font-medium text-gray-300 mb-1.5">CVV</label>
                  <div className="relative">
                    <input
                      id="card-cvv"
                      type={showCVV ? 'text' : 'password'}
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                      maxLength={4}
                      placeholder="•••"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCVV(!showCVV)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                    >
                      {showCVV ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : category === 'Passkey' ? (
            <div className="space-y-4 border-t border-white/5 pt-4">
              <div>
                <label htmlFor="passkey-rp" className="block text-sm font-medium text-gray-300 mb-1.5">Relying Party (Rp ID / Domain)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="passkey-rp"
                    type="text"
                    value={passkeyRpId}
                    onChange={(e) => setPasskeyRpId(e.target.value)}
                    placeholder="e.g. google.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="passkey-user" className="block text-sm font-medium text-gray-300 mb-1.5">Username / User handle</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="passkey-user"
                    type="text"
                    value={passkeyUsername}
                    onChange={(e) => setPasskeyUsername(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="passkey-id" className="block text-sm font-medium text-gray-300 mb-1.5">Credential ID (Base64 / Hex)</label>
                <input
                  id="passkey-id"
                  type="text"
                  value={passkeyId}
                  onChange={(e) => setPasskeyId(e.target.value)}
                  placeholder="Paste Credential ID..."
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="passkey-pubkey" className="block text-sm font-medium text-gray-300">Public Key (Base64 SPKI)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const mockId = btoa(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
                      const mockPub = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + btoa(Math.random().toString()).slice(0, 64) + 'IDAQAB';
                      setPasskeyId(mockId);
                      setPasskeyPublicKey(mockPub);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    Generate Mock Passkey Data
                  </button>
                </div>
                <textarea
                  id="passkey-pubkey"
                  value={passkeyPublicKey}
                  onChange={(e) => setPasskeyPublicKey(e.target.value)}
                  placeholder="Paste Base64 Public Key..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono resize-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="cred-url" className="block text-sm font-medium text-gray-300 mb-1.5">Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="cred-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cred-username" className="block text-sm font-medium text-gray-300 mb-1.5">Username / Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="cred-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cred-password" className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                  <input
                    id="cred-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    autoComplete="new-password"
                    className="w-full pl-10 pr-20 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGenerator(!showGenerator)}
                      className={`p-1.5 rounded-md transition-colors ${showGenerator ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 text-gray-500'}`}
                      aria-label="Toggle password generator"
                      aria-expanded={showGenerator}
                    >
                      <Wand2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {showGenerator && (
                <div className="animate-in slide-in-from-top-2">
                  <PasswordGenerator
                    onSelect={(pwd) => {
                      setPassword(pwd);
                      setShowGenerator(false);
                    }}
                  />
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowTotp(!showTotp)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
                  aria-expanded={showTotp}
                >
                  <Key className="w-4 h-4" aria-hidden="true" />
                  <span>2FA / TOTP Secret</span>
                  {showTotp ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                </button>
                {showTotp && (
                  <div className="mt-2">
                    <label htmlFor="cred-totp" className="sr-only">TOTP Secret</label>
                    <input
                      id="cred-totp"
                      type="text"
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value.replace(/\s/g, '').toUpperCase())}
                      placeholder="Base32 TOTP secret (e.g., JBSWY3DPEHPK3PXP)"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the Base32-encoded secret from your 2FA provider
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="cred-notes" className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
            <textarea
              id="cred-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm resize-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            aria-label={isEditing ? 'Save changes' : 'Add credential'}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Saving" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{isEditing ? 'Save Changes' : 'Add Credential'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
