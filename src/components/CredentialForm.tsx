import { useState, useEffect } from 'react';
import {
  X, Save, Eye, EyeOff, Globe, User, Lock, FileText,
  Key, Wand2, ChevronDown, ChevronUp
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import PasswordGenerator from './PasswordGenerator';
import type { Credential } from '@/types';

interface CredentialFormProps {
  credential?: Credential | null;
  onClose: () => void;
}

const CATEGORIES = ['Login', 'Email', 'Social', 'Finance', 'Work', 'Other'];

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

  useEffect(() => {
    if (credential?.totpSecret) setShowTotp(true);
  }, [credential]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isEditing && credential) {
        await updateCredential(credential.id, {
          title, url, username, password, notes, totpSecret, category, favorite,
        });
      } else {
        await addCredential({
          title, url, username, password, notes, totpSecret, category, favorite,
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 id="credential-form-title" className="text-lg font-bold text-white">
            {isEditing ? 'Edit Credential' : 'Add New Credential'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close form"
          >
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
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
                placeholder="e.g., Gmail Account"
                required
                aria-required="true"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
              />
            </div>
          </div>

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
                autoComplete="off"
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
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
      </div>
    </div>
  );
}
