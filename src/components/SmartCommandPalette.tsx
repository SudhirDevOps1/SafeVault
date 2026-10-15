import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Key, ShieldCheck, Mail, CreditCard, Lock, Plus,
  Wand2, ShieldAlert, Printer, ArrowRight, Copy, Check, X
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { useClipboard } from '@/hooks/useClipboard';
import { generateTOTP, getTOTPTimeRemaining } from '@/utils/totp';

interface SmartCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
  onOpenEmergencyKit: () => void;
}

interface PaletteAction {
  id: string;
  type: 'action' | 'credential' | 'totp' | 'alias' | 'card';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  extraAction?: {
    label: string;
    icon: React.ReactNode;
    handler: (e: React.MouseEvent) => void;
  };
}

export default function SmartCommandPalette({
  isOpen,
  onClose,
  onOpenAddModal,
  onOpenEmergencyKit,
}: SmartCommandPaletteProps) {
  const {
    credentials,
    setSidebarView,
    setSelectedCredential,
    lockVault,
  } = useVaultStore();

  const { copiedField, copyToClipboard } = useClipboard();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'logins' | '2fa' | 'aliases' | 'commands'>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(getTOTPTimeRemaining());

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setFilterType('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Update TOTP timer and compute codes for credentials with totpSecret
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const updateCodes = async () => {
      const activeCredentialsWithTotp = credentials.filter(c => !!c.totpSecret && c.category !== 'Trash');
      const newCodes: Record<string, string> = {};
      
      for (const c of activeCredentialsWithTotp) {
        if (!c.totpSecret) continue;
        try {
          const code = await generateTOTP(c.totpSecret, {
            algorithm: c.totpAlgorithm,
            digits: c.totpDigits || 6,
            period: c.totpPeriod || 30,
            isSteam: c.notes?.toLowerCase().includes('steam')
          });
          newCodes[c.id] = code;
        } catch {
          // Ignore failed code derivations
        }
      }
      
      if (isMounted) {
        setTotpCodes(newCodes);
        setTimeRemaining(getTOTPTimeRemaining());
      }
    };

    updateCodes();
    const interval = setInterval(() => {
      setTimeRemaining(getTOTPTimeRemaining());
      if (getTOTPTimeRemaining() === 30) {
        updateCodes();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, credentials]);

  // Pre-configured Quick Action Commands
  const quickActions: PaletteAction[] = useMemo(() => [
    {
      id: 'cmd-add',
      type: 'action',
      title: 'New Credential',
      subtitle: 'Create a new login, card, note or alias',
      badge: 'Action',
      icon: <Plus className="w-4 h-4 text-emerald-400" />,
      onSelect: () => {
        onClose();
        onOpenAddModal();
      },
    },
    {
      id: 'cmd-2fa',
      type: 'action',
      title: 'Authenticator Hub (2FA)',
      subtitle: 'RFC 6238 live codes & Google Auth sync',
      badge: 'View',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      onSelect: () => {
        setSidebarView('authenticator');
        setSelectedCredential(null);
        onClose();
      },
    },
    {
      id: 'cmd-generator',
      type: 'action',
      title: 'Password Generator',
      subtitle: 'Generate high-entropy quantum-proof passwords & passphrases',
      badge: 'Tools',
      icon: <Wand2 className="w-4 h-4 text-purple-400" />,
      onSelect: () => {
        setSidebarView('generator');
        setSelectedCredential(null);
        onClose();
      },
    },
    {
      id: 'cmd-aliases',
      type: 'action',
      title: 'Email Aliases Hub',
      subtitle: 'Create anonymous +clean and domain email aliases',
      badge: 'Privacy',
      icon: <Mail className="w-4 h-4 text-blue-400" />,
      onSelect: () => {
        setSidebarView('aliases');
        setSelectedCredential(null);
        onClose();
      },
    },
    {
      id: 'cmd-health',
      type: 'action',
      title: 'Vault Security & Health Audit',
      subtitle: 'Analyze weak passwords, reused credentials & breaches',
      badge: 'Audit',
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
      onSelect: () => {
        setSidebarView('health');
        setSelectedCredential(null);
        onClose();
      },
    },
    {
      id: 'cmd-emergency',
      type: 'action',
      title: 'Print Emergency Recovery Kit',
      subtitle: 'Physical paper backup of your zero-knowledge master key',
      badge: 'Safety',
      icon: <Printer className="w-4 h-4 text-teal-400" />,
      onSelect: () => {
        onClose();
        onOpenEmergencyKit();
      },
    },
    {
      id: 'cmd-lock',
      type: 'action',
      title: 'Lock Vault Now',
      subtitle: 'Clear all decrypted keys & lock memory',
      badge: 'Security',
      icon: <Lock className="w-4 h-4 text-rose-400" />,
      onSelect: () => {
        onClose();
        lockVault();
      },
    },
  ], [onClose, onOpenAddModal, setSidebarView, setSelectedCredential, onOpenEmergencyKit, lockVault]);

  // Fuzzy filter actions and items based on search query
  const filteredItems = useMemo<PaletteAction[]>(() => {
    const q = query.trim().toLowerCase();
    const result: PaletteAction[] = [];

    // Filter Quick Actions if relevant
    if (filterType === 'all' || filterType === 'commands') {
      const matchedActions = q
        ? quickActions.filter(a => a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q)))
        : quickActions;
      result.push(...matchedActions);
    }

    // 2FA Accounts (Top Priority in Search when 2FA is available)
    if (filterType === 'all' || filterType === '2fa') {
      const totpItems = credentials
        .filter(c => !!c.totpSecret && c.category !== 'Trash')
        .filter(c => !q || c.title.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || (c.url && c.url.toLowerCase().includes(q)))
        .map(c => {
          const code = totpCodes[c.id] || '......';
          const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
          return {
            id: `totp-${c.id}`,
            type: 'totp' as const,
            title: c.title,
            subtitle: `${c.username || '2FA'} • ${formattedCode}`,
            badge: `${timeRemaining}s`,
            icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
            onSelect: () => {
              copyToClipboard(code, `totp-${c.id}`);
            },
            extraAction: {
              label: copiedField === `totp-${c.id}` ? 'Copied!' : 'Copy Code',
              icon: copiedField === `totp-${c.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />,
              handler: (e: React.MouseEvent) => {
                e.stopPropagation();
                copyToClipboard(code, `totp-${c.id}`);
              }
            }
          };
        });
      result.push(...totpItems);
    }

    // Aliases
    if (filterType === 'all' || filterType === 'aliases') {
      const aliasItems = credentials
        .filter(c => c.category === 'Alias')
        .filter(c => !q || c.title.toLowerCase().includes(q) || c.username.toLowerCase().includes(q))
        .map(c => ({
          id: `alias-${c.id}`,
          type: 'alias' as const,
          title: c.title,
          subtitle: c.username,
          badge: c.aliasStatus === 'paused' ? 'Paused' : c.aliasStatus === 'blocked' ? 'Blocked' : 'Active',
          icon: <Mail className="w-4 h-4 text-blue-400" />,
          onSelect: () => {
            copyToClipboard(c.username, `alias-${c.id}`);
          },
          extraAction: {
            label: copiedField === `alias-${c.id}` ? 'Copied!' : 'Copy Alias',
            icon: copiedField === `alias-${c.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />,
            handler: (e: React.MouseEvent) => {
              e.stopPropagation();
              copyToClipboard(c.username, `alias-${c.id}`);
            }
          }
        }));
      result.push(...aliasItems);
    }

    // Logins and Credentials
    if (filterType === 'all' || filterType === 'logins') {
      const loginItems = credentials
        .filter(c => c.category !== 'Alias' && c.category !== 'Trash')
        .filter(c => !q || c.title.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || (c.url && c.url.toLowerCase().includes(q)))
        .map(c => ({
          id: `cred-${c.id}`,
          type: (c.category === 'Payment Card' ? 'card' : 'credential') as 'card' | 'credential',
          title: c.title,
          subtitle: c.username || (c.url ? new URL(c.url.startsWith('http') ? c.url : `https://${c.url}`).hostname : ''),
          badge: c.category,
          icon: c.category === 'Payment Card' ? <CreditCard className="w-4 h-4 text-amber-400" /> : <Key className="w-4 h-4 text-emerald-400" />,
          onSelect: () => {
            setSelectedCredential(c.id);
            setSidebarView('all');
            onClose();
          },
          extraAction: c.password ? {
            label: copiedField === `pwd-${c.id}` ? 'Copied!' : 'Password',
            icon: copiedField === `pwd-${c.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />,
            handler: (e: React.MouseEvent) => {
              e.stopPropagation();
              copyToClipboard(c.password, `pwd-${c.id}`);
            }
          } : undefined
        }));
      result.push(...loginItems);
    }

    return result;
  }, [query, filterType, quickActions, credentials, totpCodes, timeRemaining, copiedField, copyToClipboard, setSelectedCredential, setSidebarView, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (activeIndex >= filteredItems.length && filteredItems.length > 0) {
      setActiveIndex(0);
    }
  }, [filteredItems.length, activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[activeIndex]) {
        filteredItems[activeIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-3 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Smart Command Palette"
    >
      <div className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[75vh]">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-gray-950/70">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, login, 2FA code or alias..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none"
            aria-label="Command search query"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-gray-500 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 font-mono">
              ESC to close
            </kbd>
          )}
        </div>

        {/* Filter Chips for Fast Switching */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-950/40 border-b border-white/5 overflow-x-auto no-scrollbar">
          {(['all', 'logins', '2fa', 'aliases', 'commands'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilterType(f); setActiveIndex(0); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-all ${
                filterType === f
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all' ? '✨ All Results' : f === '2fa' ? '🛡️ 2FA Codes' : f === 'aliases' ? '📧 Aliases' : f === 'logins' ? '🔑 Logins' : '⚡ Commands'}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto flex-1 divide-y divide-white/5 p-1.5">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No matching items or commands found</p>
              <p className="text-xs text-gray-600 mt-1">Try typing &ldquo;add&rdquo;, &ldquo;generator&rdquo;, &ldquo;lock&rdquo;, or an account name</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === activeIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
                    isSelected ? 'bg-emerald-500/15 text-white' : 'hover:bg-white/5 text-gray-200'
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === 'totp' ? 'bg-emerald-500/20' : item.type === 'alias' ? 'bg-blue-500/20' : item.type === 'action' ? 'bg-purple-500/20' : 'bg-white/10'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate text-white">{item.title}</span>
                        {item.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            item.type === 'totp' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className={`text-xs truncate ${item.type === 'totp' ? 'font-mono font-bold text-emerald-400' : 'text-gray-400'}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.extraAction && (
                      <button
                        onClick={item.extraAction.handler}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 rounded-lg text-xs font-medium border border-white/10 transition-colors"
                        title={item.extraAction.label}
                      >
                        {item.extraAction.icon}
                        <span>{item.extraAction.label}</span>
                      </button>
                    )}
                    <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-0.5 text-emerald-400' : 'text-gray-600'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2 border-t border-white/5 bg-gray-950/60 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">ESC</kbd> Close</span>
          </div>
          <span className="font-mono text-emerald-400 font-semibold">{filteredItems.length} items</span>
        </div>
      </div>
    </div>
  );
}
