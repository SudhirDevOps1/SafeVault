import { useEffect, useRef } from 'react';
import {
  Shield, Key, Star, Wand2, Settings, Lock, Plus, Search, Keyboard, Download
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

      {/* Desktop App Download Options (Web Only) */}
      {!(typeof window !== 'undefined' && 'electron' in window) && (() => {
        const APP_VERSION = '1.1.5';
        const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
        let detectedOS = 'Windows';
        let directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault.Setup.${APP_VERSION}.exe`;
        
        if (userAgent.includes('mac')) {
          detectedOS = 'macOS';
          directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault-${APP_VERSION}-arm64.dmg`;
        } else if (userAgent.includes('linux')) {
          detectedOS = 'Linux';
          directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault-${APP_VERSION}.AppImage`;
        }

        return (
          <div className="mx-3 my-2 p-3 bg-white/5 border border-white/5 rounded-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Download Desktop</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2.5 leading-relaxed">Run securely offline on your device</p>
            
            {/* Direct Download Button */}
            <a
              href={directUrl}
              className="block w-full py-2 mb-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold text-center transition-all shadow shadow-emerald-600/20"
            >
              Download for {detectedOS}
            </a>

            {/* Alternative Links */}
            <div className="flex items-center justify-between gap-1 text-[10px] text-gray-500">
              <span>Other platforms:</span>
              <a
                href="https://github.com/SudhirDevOps1/SafeVault/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                View all
              </a>
            </div>
          </div>
        );
      })()}


      {/* Open Source / GitHub repository link */}
      <div className="px-3 py-2 border-t border-white/5">
        <a
          href="https://github.com/SudhirDevOps1/SafeVault"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-150"
          aria-label="Open GitHub Repository"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
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
