import React, { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, Wand2, Copy, Check, Save, Info, Sparkles } from 'lucide-react';
import { useVaultStore } from '../stores/vaultStore';
import { useClipboard } from '../hooks/useClipboard';

export default function EmailAliases() {
  const { baseEmails, addBaseEmail, removeBaseEmail, addCredential, setSidebarView } = useVaultStore();
  const { copiedField, copyToClipboard } = useClipboard();

  // Manage State
  const [newBaseEmail, setNewBaseEmail] = useState('');
  
  // Generation State
  const [selectedBase, setSelectedBase] = useState(baseEmails[0] || 'Sudhir@gmail.com');
  const [serviceUrl, setServiceUrl] = useState('');
  const [parsedHandle, setParsedHandle] = useState('');
  const [aliasFormat, setAliasFormat] = useState<'plus' | 'dot'>('plus');
  const [generatedAlias, setGeneratedAlias] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  
  // UI Status
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync selected base email if the list changes
  useEffect(() => {
    if (baseEmails.length > 0 && !baseEmails.includes(selectedBase)) {
      setSelectedBase(baseEmails[0]);
    }
  }, [baseEmails, selectedBase]);

  // Helper to extract domain/title handle
  const extractDomainHandle = (urlStr: string): string => {
    if (!urlStr.trim()) return '';
    try {
      let tempUrl = urlStr.trim();
      if (!tempUrl.startsWith('http://') && !tempUrl.startsWith('https://')) {
        tempUrl = 'https://' + tempUrl;
      }
      const hostname = new URL(tempUrl).hostname;
      // Remove www. and sub-domains like .pages.dev or .github.io
      let part = hostname.replace('www.', '');
      
      // Special check for pages.dev / github.io subdomains
      if (part.endsWith('.pages.dev')) {
        return part.replace('.pages.dev', '');
      }
      if (part.endsWith('.github.io')) {
        return part.replace('.github.io', '');
      }

      // Fallback: take the first part of the hostname
      const parts = part.split('.');
      if (parts.length > 1) {
        return parts[0];
      }
      return part;
    } catch {
      // If it's a simple name like "Uniapp", return it lowercase
      return urlStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  };

  // Update parsed handle and generate alias on inputs change
  useEffect(() => {
    const handle = extractDomainHandle(serviceUrl);
    setParsedHandle(handle);

    if (!selectedBase || !handle) {
      setGeneratedAlias('');
      return;
    }

    const [user, domain] = selectedBase.split('@');
    if (!user || !domain) {
      setGeneratedAlias('');
      return;
    }

    if (aliasFormat === 'plus') {
      setGeneratedAlias(`${user}+${handle}@${domain}`);
    } else {
      setGeneratedAlias(`${user}.${handle}@${domain}`);
    }
  }, [serviceUrl, selectedBase, aliasFormat]);

  // Auto-generate a password for the service once a handle is entered
  useEffect(() => {
    if (parsedHandle && !generatedPassword) {
      generatePasswordForAlias();
    } else if (!parsedHandle) {
      setGeneratedPassword('');
    }
  }, [parsedHandle]);

  const generatePasswordForAlias = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|';
    let pass = '';
    for (let i = 0; i < 18; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(pass);
  };

  const handleAddBase = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newBaseEmail.trim();
    if (!email || !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid base email address.' });
      return;
    }
    addBaseEmail(email);
    setNewBaseEmail('');
    setStatusMessage({ type: 'success', text: `Added base email ${email}` });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveToVault = async () => {
    if (!generatedAlias) {
      setStatusMessage({ type: 'error', text: 'Generate an alias first by entering a website url.' });
      return;
    }

    // Auto calculate title
    const rawTitle = parsedHandle || 'Email Alias';
    const formattedTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    try {
      await addCredential({
        title: formattedTitle,
        username: generatedAlias,
        password: generatedPassword,
        url: serviceUrl.trim(),
        notes: `Auto-generated Email Alias from base email: ${selectedBase}`,
        favorite: false,
        totpSecret: '',
        category: 'Login'
      });

      setStatusMessage({ type: 'success', text: 'Alias saved successfully to your vault!' });
      
      // Auto reset and redirect to All list
      setTimeout(() => {
        setStatusMessage(null);
        setSidebarView('all');
      }, 1500);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save credential to local database.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-400" />
          Email Alias Generator
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Create secure, sub-addressed email cards (AliasVault style) to identify leaks and avoid spam.
        </p>
      </div>

      {statusMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs transition-all ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <Info className="w-4 h-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Manage Base Emails */}
        <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl h-fit space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            1. Base Emails
          </span>
          <p className="text-[11px] text-gray-500 leading-normal">
            Configure the real primary emails you own (e.g. your Gmail).
          </p>

          <form onSubmit={handleAddBase} className="flex gap-2">
            <input
              type="email"
              placeholder="e.g. Sudhir@gmail.com"
              value={newBaseEmail}
              onChange={(e) => setNewBaseEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
            />
            <button
              type="submit"
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {baseEmails.map((email) => (
              <div key={email} className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-xl text-xs font-mono">
                <span className="text-gray-300 truncate pr-2">{email}</span>
                {baseEmails.length > 1 && (
                  <button
                    onClick={() => removeBaseEmail(email)}
                    className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (Span 2): Generator Interface */}
        <div className="lg:col-span-2 bg-[#121212]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl space-y-5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            2. Design Suffix Alias
          </span>

          <div className="space-y-4">
            {/* Choose Base Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">Select Base Email</label>
              <select
                value={selectedBase}
                onChange={(e) => setSelectedBase(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
              >
                {baseEmails.map(email => (
                  <option key={email} value={email} className="bg-[#121212] text-white">
                    {email}
                  </option>
                ))}
              </select>
            </div>

            {/* Target URL */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">Target Website Link / URL</label>
              <input
                type="text"
                placeholder="e.g. https://uniapp-web.pages.dev/"
                value={serviceUrl}
                onChange={(e) => setServiceUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
              />
            </div>

            {/* Suffix format selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 block">Sub-addressing Suffix Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAliasFormat('plus')}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    aliasFormat === 'plus'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  Plus (+) Format
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">Sudhir+uniapp@gmail.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAliasFormat('dot')}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    aliasFormat === 'dot'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  Dot (.) Format
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">Sudhir.uniapp@gmail.com</span>
                </button>
              </div>
            </div>

            {/* Generated Outputs */}
            {generatedAlias && (
              <div className="pt-3 border-t border-white/5 space-y-4 animate-fade-in">
                {/* Generated Alias Box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Generated Alias Email</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedAlias}
                      className="flex-1 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedAlias, 'alias')}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                      title="Copy Alias"
                    >
                      {copiedField === 'alias' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Box */}
                {generatedPassword && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Associated Service Password</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedPassword}
                        className="flex-1 px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-300 font-mono focus:outline-none"
                      />
                      <button
                        onClick={generatePasswordForAlias}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                        title="Re-generate Password"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(generatedPassword, 'pass')}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                        title="Copy Password"
                      >
                        {copiedField === 'pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveToVault}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save as Card in Vault
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
