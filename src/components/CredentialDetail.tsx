import { useState, useEffect } from 'react';
import {
  Copy, Check, Eye, EyeOff, Edit, Trash2, Globe, User,
  Lock, FileText, Star, ExternalLink, ArrowLeft, Key
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
  const { deleteCredential, updateCredential, setSelectedCredential, networkApprovedThisSession } = useVaultStore();
  const { copiedField, copyToClipboard } = useClipboard();
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageError, setImageError] = useState(false);

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
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const favicon = (credential.url && networkApprovedThisSession) ? getFavicon(credential.url) : null;

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
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
        <div className="p-6 border-b border-white/5">
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
                    <span className="text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Email Alias
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
