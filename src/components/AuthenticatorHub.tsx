import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Search, Plus, Copy, Check, ExternalLink, Key, AlertCircle, X,
  QrCode, Sparkles
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { useClipboard } from '@/hooks/useClipboard';
import {
  generateTOTP, generateNextTOTP, getTOTPTimeRemaining, parseOtpAuthUri,
  isValidTOTPSecret, parseGoogleAuthMigration, type TOTPAlgorithm, type GoogleAuthAccount
} from '@/utils/totp';

export default function AuthenticatorHub() {
  const credentials = useVaultStore(state => state.credentials);
  const addCredential = useVaultStore(state => state.addCredential);
  const { copiedField, copyToClipboard } = useClipboard();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(getTOTPTimeRemaining());
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [nextCodes, setNextCodes] = useState<Record<string, string>>({});

  // Add 2FA Modal Form State
  const [formUri, setFormUri] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formAlgorithm, setFormAlgorithm] = useState<TOTPAlgorithm>('SHA-1');
  const [formDigits, setFormDigits] = useState<6 | 8>(6);
  const [formPeriod, setFormPeriod] = useState<number>(30);
  const [formIsSteam, setFormIsSteam] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Google Authenticator Migration State
  const [migrationInput, setMigrationInput] = useState('');
  const [parsedAccounts, setParsedAccounts] = useState<GoogleAuthAccount[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Filter credentials that have 2FA
  const authAccounts = useMemo(() => {
    return credentials.filter(c => !!c.totpSecret && c.category !== 'Trash');
  }, [credentials]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return authAccounts;
    const q = search.toLowerCase();
    return authAccounts.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.url && c.url.toLowerCase().includes(q))
    );
  }, [authAccounts, search]);

  // Compute live codes on timer tick
  useEffect(() => {
    let isMounted = true;

    const updateAllCodes = async () => {
      const newCodes: Record<string, string> = {};
      const newNextCodes: Record<string, string> = {};

      for (const account of authAccounts) {
        if (!account.totpSecret) continue;
        try {
          const opts = {
            algorithm: account.totpAlgorithm,
            digits: account.totpDigits,
            period: account.totpPeriod,
            isSteam: account.isSteamTotp
          };
          const code = await generateTOTP(account.totpSecret, opts);
          const next = await generateNextTOTP(account.totpSecret, opts);
          newCodes[account.id] = code;
          newNextCodes[account.id] = next;
        } catch {
          newCodes[account.id] = 'ERROR';
          newNextCodes[account.id] = 'ERROR';
        }
      }
      if (isMounted) {
        setCodes(newCodes);
        setNextCodes(newNextCodes);
      }
    };

    updateAllCodes();

    const interval = setInterval(() => {
      const remaining = getTOTPTimeRemaining();
      setTimeRemaining(remaining);
      if (remaining >= 29) {
        updateAllCodes();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authAccounts]);

  // Parse URI whenever formUri changes
  const handleUriChange = (val: string) => {
    setFormUri(val);
    setFormError(null);
    if (val.startsWith('otpauth://')) {
      const parsed = parseOtpAuthUri(val);
      if (parsed) {
        setFormSecret(parsed.secret);
        setFormTitle(parsed.issuer || parsed.label.split(':')[0] || '2FA Account');
        if (parsed.label.includes(':')) {
          setFormUsername(parsed.label.split(':')[1].trim());
        } else {
          setFormUsername(parsed.label);
        }
        setFormAlgorithm(parsed.algorithm);
        setFormDigits(parsed.digits as 6 | 8);
        setFormPeriod(parsed.period);
      } else {
        setFormError('Invalid otpauth URI format.');
      }
    }
  };

  const handleSave2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSecret = formSecret.replace(/[\s=-]/g, '').toUpperCase();
    if (!isValidTOTPSecret(cleanSecret)) {
      setFormError('Secret key must be a valid Base32 string (letters A-Z and digits 2-7, min 16 chars).');
      return;
    }

    if (!formTitle.trim()) {
      setFormError('Please provide a title or service name (e.g., Google, GitHub).');
      return;
    }

    try {
      await addCredential({
        title: formTitle.trim(),
        username: formUsername.trim(),
        password: '',
        url: '',
        notes: formIsSteam ? 'Steam Guard Authenticator' : 'Proton-style TOTP Authenticator',
        totpSecret: cleanSecret,
        totpAlgorithm: formAlgorithm,
        totpDigits: formDigits,
        totpPeriod: formPeriod,
        isSteamTotp: formIsSteam,
        category: 'Logins',
        favorite: false
      });

      // Reset modal
      setShowAddModal(false);
      setFormUri('');
      setFormTitle('');
      setFormUsername('');
      setFormSecret('');
      setFormIsSteam(false);
      setFormError(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save 2FA account.');
    }
  };

  const handleMigrationInputChange = (val: string) => {
    setMigrationInput(val);
    setMigrationError(null);
    if (!val.trim()) {
      setParsedAccounts([]);
      setSelectedIndices(new Set());
      return;
    }
    try {
      const accounts = parseGoogleAuthMigration(val);
      if (accounts.length === 0) {
        setMigrationError('No accounts detected. Make sure you pasted a valid otpauth-migration:// URI from Google Authenticator.');
        setParsedAccounts([]);
        setSelectedIndices(new Set());
      } else {
        setParsedAccounts(accounts);
        setSelectedIndices(new Set(accounts.map((_, i) => i)));
      }
    } catch {
      setMigrationError('Failed to parse Google Authenticator export data.');
      setParsedAccounts([]);
      setSelectedIndices(new Set());
    }
  };

  const handleToggleSelectAccount = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIndices.size === parsedAccounts.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedAccounts.map((_, i) => i)));
    }
  };

  const handleImportGoogleAccounts = async () => {
    if (selectedIndices.size === 0) return;
    setIsImporting(true);
    setMigrationError(null);
    try {
      for (const idx of selectedIndices) {
        const acc = parsedAccounts[idx];
        if (!acc) continue;
        const title = acc.issuer || acc.name.split(':')[0] || 'Imported 2FA';
        const username = acc.name.includes(':') ? acc.name.split(':')[1].trim() : (acc.issuer ? acc.name : '');
        
        await addCredential({
          title,
          username,
          password: '',
          url: '',
          notes: 'Imported from Google Authenticator (Zero-Knowledge)',
          totpSecret: acc.secret,
          totpAlgorithm: acc.algorithm,
          totpDigits: acc.digits,
          totpPeriod: 30,
          category: 'Logins',
          favorite: false
        });
      }
      setShowGoogleModal(false);
      setMigrationInput('');
      setParsedAccounts([]);
      setSelectedIndices(new Set());
    } catch (err: any) {
      setMigrationError(err.message || 'Failed to import 2FA accounts.');
    } finally {
      setIsImporting(false);
    }
  };

  const progress = (timeRemaining / 30) * 100;
  const isLow = timeRemaining <= 5;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-gray-900/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Authenticator</h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                {authAccounts.length} {authAccounts.length === 1 ? 'account' : 'accounts'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Proton Authenticator Hub with live RFC 6238 & Steam Guard verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGoogleModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white font-medium text-sm rounded-xl border border-white/10 transition-all active:scale-95"
            title="Import all accounts from Google Authenticator QR/Export URI"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Import Google Auth</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add 2FA Code</span>
          </button>
        </div>
      </div>

      {/* Global Countdown & Search Bar */}
      <div className="px-6 py-4 border-b border-white/5 bg-gray-950/60 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 2FA accounts (Google, GitHub, Steam, etc.)..."
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        {/* Global Circular Timer */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl shrink-0">
          <div className="relative w-6 h-6">
            <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
              <circle
                cx="12" cy="12" r="10"
                fill="none"
                stroke={isLow ? '#ef4444' : '#10b981'}
                strokeWidth="2.5"
                strokeDasharray={`${progress * 0.628} 62.8`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
              {timeRemaining}
            </span>
          </div>
          <span className="text-xs font-medium text-gray-400">Next Code</span>
        </div>
      </div>

      {/* 2FA Accounts Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAccounts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No 2FA Accounts Found</h3>
            <p className="text-xs text-gray-400 mb-6">
              {search.trim() ? 'No accounts matched your search query.' : 'Add two-factor authentication codes to secure your online accounts.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add First 2FA Account</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map(account => {
              const code = codes[account.id] || '------';
              const isCopied = copiedField === `totp-${account.id}`;
              const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

              return (
                <div
                  key={account.id}
                  className="bg-gray-900/60 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/5 group flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title & Badges */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-base text-white truncate">{account.title}</span>
                        {account.isSteamTotp && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                            STEAM
                          </span>
                        )}
                      </div>
                      {account.url && (
                        <a
                          href={account.url.startsWith('http') ? account.url : `https://${account.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-500 hover:text-emerald-400 transition-colors p-1"
                          title="Open website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Account Username */}
                    {account.username && (
                      <p className="text-xs text-gray-400 truncate mb-4">{account.username}</p>
                    )}
                  </div>

                  {/* Code Display & Copy */}
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between mt-auto">
                    <div>
                      <div className={`font-mono text-2xl font-bold tracking-[0.2em] ${isLow ? 'text-red-400' : 'text-emerald-400'} transition-colors`}>
                        {formattedCode}
                      </div>
                      {nextCodes[account.id] && nextCodes[account.id] !== 'ERROR' && (
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-1.5">
                          <span className="text-gray-500">Next:</span>
                          <span className={isLow ? 'text-amber-400 font-semibold' : 'text-gray-400'}>
                            {nextCodes[account.id].length === 6 ? `${nextCodes[account.id].slice(0, 3)} ${nextCodes[account.id].slice(3)}` : nextCodes[account.id]}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => copyToClipboard(code, `totp-${account.id}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isCopied
                          ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20'
                          : 'bg-white/10 hover:bg-emerald-500 hover:text-gray-950 text-gray-200'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add 2FA Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Add 2FA Authenticator Code</h3>
                <p className="text-xs text-gray-400">Paste your secret key or otpauth:// URI</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave2FA} className="space-y-4">
              {/* OTPAuth URI input */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  otpauth:// URI (Optional — auto-fills details)
                </label>
                <input
                  type="text"
                  value={formUri}
                  onChange={(e) => handleUriChange(e.target.value)}
                  placeholder="otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Service Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Google, GitHub, Binance"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Secret Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Base32 Secret Key *
                </label>
                <input
                  type="text"
                  required
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="JBSWY3DPEHPK3PXP"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-emerald-400 font-mono placeholder-gray-500 focus:outline-none focus:border-emerald-500 uppercase tracking-wider"
                />
              </div>

              {/* Advanced Options Toggle */}
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Steam Guard Authenticator</span>
                  <input
                    type="checkbox"
                    checked={formIsSteam}
                    onChange={(e) => setFormIsSteam(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-0 w-4 h-4 bg-gray-800 border-gray-700"
                  />
                </div>

                {!formIsSteam && (
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Algorithm</label>
                      <select
                        value={formAlgorithm}
                        onChange={(e) => setFormAlgorithm(e.target.value as any)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg text-xs p-1.5 text-white"
                      >
                        <option value="SHA-1">SHA-1</option>
                        <option value="SHA-256">SHA-256</option>
                        <option value="SHA-512">SHA-512</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Digits</label>
                      <select
                        value={formDigits}
                        onChange={(e) => setFormDigits(Number(e.target.value) as any)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg text-xs p-1.5 text-white"
                      >
                        <option value={6}>6 Digits</option>
                        <option value={8}>8 Digits</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Period</label>
                      <select
                        value={formPeriod}
                        onChange={(e) => setFormPeriod(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg text-xs p-1.5 text-white"
                      >
                        <option value={30}>30s</option>
                        <option value={60}>60s</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-transparent text-gray-400 hover:text-white text-xs font-semibold rounded-xl border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                >
                  Save 2FA Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Authenticator Migration Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setShowGoogleModal(false);
                setMigrationInput('');
                setParsedAccounts([]);
                setSelectedIndices(new Set());
                setMigrationError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Google Authenticator Batch Import</span>
                  <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                    Zero-Knowledge
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Import all your 2FA accounts in 1-click without any cloud intermediary
                </p>
              </div>
            </div>

            {migrationError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{migrationError}</span>
              </div>
            )}

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Migration Payload or QR Data URL
                </label>
                <textarea
                  value={migrationInput}
                  onChange={(e) => handleMigrationInputChange(e.target.value)}
                  placeholder="Paste otpauth-migration://offline?data=... export URL here"
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500/50"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  On phone: Open Google Authenticator → Menu (☰) → <strong>Transfer accounts</strong> → <strong>Export accounts</strong>.
                </p>
              </div>

              {parsedAccounts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-xs font-semibold text-white">
                      Discovered Accounts ({selectedIndices.size}/{parsedAccounts.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {selectedIndices.size === parsedAccounts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {parsedAccounts.map((acc, index) => {
                      const isSelected = selectedIndices.has(index);
                      const title = acc.issuer || acc.name.split(':')[0] || '2FA Account';
                      const user = acc.name.includes(':') ? acc.name.split(':')[1].trim() : (acc.issuer ? acc.name : '');

                      return (
                        <div
                          key={index}
                          onClick={() => handleToggleSelectAccount(index)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-white/5 border-white/5 hover:border-white/15 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Controlled by container onClick
                              className="rounded text-emerald-500 focus:ring-0 w-4 h-4 bg-gray-800 border-gray-700 pointer-events-none"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{title}</p>
                              {user && <p className="text-[11px] text-gray-400 truncate">{user}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-gray-400">
                              {acc.algorithm}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-gray-400">
                              {acc.digits} Digits
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleModal(false);
                  setMigrationInput('');
                  setParsedAccounts([]);
                  setSelectedIndices(new Set());
                  setMigrationError(null);
                }}
                className="px-4 py-2 bg-transparent text-gray-400 hover:text-white text-xs font-semibold rounded-xl border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportGoogleAccounts}
                disabled={selectedIndices.size === 0 || isImporting}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {isImporting ? (
                  <span>Importing...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Import {selectedIndices.size} {selectedIndices.size === 1 ? 'Account' : 'Accounts'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
