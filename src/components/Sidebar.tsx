import { useEffect, useRef } from 'react';
import {
  Shield, Key, Star, Wand2, Settings, Lock, Plus, Search, Keyboard,
  Github
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import type { SidebarView } from '@/types';

interface SidebarProps {
  onAddCredential: () => void;
}

export default function Sidebar({ onAddCredential }: SidebarProps) {
  const {
    sidebarView, setSidebarView, lockVault, credentials,
    searchQuery, setSearchQuery,
  } = useVaultStore();
  
  const searchRef = useRef<HTMLInputElement>(null);

  // Handle focus-search event from keyboard shortcut
  useEffect(() => {
    const handler = () => {
      searchRef.current?.focus();
    };
    window.addEventListener('safevault:focus-search', handler);
    return () => window.removeEventListener('safevault:focus-search', handler);
  }, []);

  const navItems: { view: SidebarView; icon: React.ReactNode; label: string; count?: number; ariaLabel: string }[] = [
    { view: 'all', icon: <Key className="w-4 h-4" aria-hidden="true" />, label: 'All Items', count: credentials.length, ariaLabel: 'Show all credentials' },
    { view: 'favorites', icon: <Star className="w-4 h-4" aria-hidden="true" />, label: 'Favorites', count: credentials.filter(c => c.favorite).length, ariaLabel: 'Show favorite credentials' },
    { view: 'generator', icon: <Wand2 className="w-4 h-4" aria-hidden="true" />, label: 'Generator', ariaLabel: 'Open password generator' },
    { view: 'settings', icon: <Settings className="w-4 h-4" aria-hidden="true" />, label: 'Settings', ariaLabel: 'Open settings' },
  ];

  return (
    <div className="w-64 h-full bg-gray-950/50 border-r border-white/5 flex flex-col shrink-0" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/10" aria-hidden="true">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">SafeVault</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Encrypted</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault... (Ctrl+K)"
            aria-label="Search credentials"
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all"
          />
        </div>
      </div>

      {/* Add Button */}
      <div className="px-3 pb-2">
        <button
          onClick={onAddCredential}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          aria-label="Add new credential (Ctrl+N)"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Credential
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Navigation sections">
        {navItems.map(({ view, icon, label, count, ariaLabel }) => (
          <button
            key={view}
            onClick={() => setSidebarView(view)}
            aria-current={sidebarView === view ? 'page' : undefined}
            aria-label={ariaLabel}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
              sidebarView === view
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {icon}
            <span className="flex-1 text-left">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                sidebarView === view ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
              }`} aria-label={`${count} items`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Open Source / GitHub repository link */}
      <div className="px-3 py-2 border-t border-white/5">
        <a
          href="https://github.com/SudhirDevOps1/SafeVault"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-150"
          aria-label="Open GitHub Repository"
        >
          <Github className="w-4 h-4" aria-hidden="true" />
          <span>GitHub Repository</span>
        </a>
      </div>

      {/* Shortcuts hint */}
      <div className="px-3 py-1 text-center">
        <span className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
          <Keyboard className="w-3 h-3" aria-hidden="true" />
          Press <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono">/</kbd> for shortcuts
        </span>
      </div>

      {/* Lock Button */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={lockVault}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          aria-label="Lock vault (Ctrl+Shift+L)"
        >
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span>Lock Vault</span>
        </button>
      </div>
    </div>
  );
}
