import { useState, useMemo, useEffect } from 'react';
import { useVaultStore } from '@/stores/vaultStore';
import Sidebar from './Sidebar';
import CredentialList from './CredentialList';
import CredentialDetail from './CredentialDetail';
import CredentialForm from './CredentialForm';
import PasswordGenerator from './PasswordGenerator';
import Settings from './Settings';
import PrivacyPolicy from './PrivacyPolicy';
import EmailAliases from './EmailAliases';
import PasswordHealth from './PasswordHealth';
import SecureShare from './SecureShare';
import AuthenticatorHub from './AuthenticatorHub';
import UpdateModal from './UpdateModal';
import SmartCommandPalette from './SmartCommandPalette';
import EmergencyKitModal from './EmergencyKitModal';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useSystemSleepLock } from '@/hooks/useSystemSleepLock';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { evaluatePasswordStrength } from '@/utils/crypto';
import {
  Shield, Plus, Menu, X, Keyboard, Key, Sparkles, Settings as SettingsIcon,
  Search, ShieldCheck, Mail
} from 'lucide-react';
import { SHORTCUT_DESCRIPTIONS } from '@/hooks/useKeyboardShortcuts';

export default function Dashboard() {
  const {
    selectedCredentialId, credentials, sidebarView, showPrivacyPolicy,
    setSidebarView, lockVault, setSelectedCredential, updateAvailable,
    checkForUpdates, networkApprovedThisSession, approveNetworkThisSession,
  } = useVaultStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showEmergencyKitModal, setShowEmergencyKitModal] = useState(false);

  // Auto-lock on inactivity
  useAutoLock();

  // System sleep/hibernate detection
  useSystemSleepLock();

  // Listen for custom palette events
  useEffect(() => {
    const handleOpenPalette = () => setShowCommandPalette(true);
    window.addEventListener('safevault:open-palette', handleOpenPalette);
    return () => window.removeEventListener('safevault:open-palette', handleOpenPalette);
  }, []);

  const selectedCredential = useMemo(
    () => credentials.find(c => c.id === selectedCredentialId) || null,
    [credentials, selectedCredentialId]
  );

  const isExtension = typeof window !== 'undefined' && !!(window as any).chrome?.runtime?.id;

  const totpCount = useMemo(() => credentials.filter(c => !!c.totpSecret && c.category !== 'Trash').length, [credentials]);
  const aliasCount = useMemo(() => credentials.filter(c => c.category === 'Alias').length, [credentials]);

  // Compute live security scorecard badge
  const healthBadge = useMemo(() => {
    let weakCount = 0;
    let evalCount = 0;
    let totalScore = 0;
    for (const c of credentials) {
      if (c.category === 'Payment Card' || c.category === 'Passkey' || c.category === 'Trash' || !c.password) continue;
      evalCount++;
      const res = evaluatePasswordStrength(c.password);
      totalScore += res.score;
      if (res.score < 3) weakCount++;
    }
    const score = evalCount > 0 ? Math.round((totalScore / evalCount) * 25) : 100;
    return { score, weakCount, totalLogins: evalCount };
  }, [credentials]);

  const handleAddCredential = () => {
    setShowAddForm(true);
    setSidebarView('all');
  };

  const handleLock = () => {
    lockVault();
  };

  const handleFocusSearch = () => {
    setShowCommandPalette(true);
  };

  const handleEscape = () => {
    if (showCommandPalette) {
      setShowCommandPalette(false);
    } else if (showAddForm) {
      setShowAddForm(false);
    } else if (showEmergencyKitModal) {
      setShowEmergencyKitModal(false);
    } else if (selectedCredentialId) {
      setSelectedCredential(null);
    } else if (showShortcutsHelp) {
      setShowShortcutsHelp(false);
    }
  };

  // Register keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      combo: { key: 'l', ctrl: true, shift: true },
      handler: handleLock,
      description: 'Lock vault',
    },
    {
      combo: { key: 'n', ctrl: true },
      handler: handleAddCredential,
      description: 'New credential',
    },
    {
      combo: { key: 'k', ctrl: true },
      handler: handleFocusSearch,
      description: 'Command palette / search',
    },
    {
      combo: { key: 'g', ctrl: true },
      handler: () => setSidebarView('generator'),
      description: 'Password generator',
    },
    {
      combo: { key: '/', ctrl: false },
      handler: () => setShowShortcutsHelp(true),
      description: 'Show shortcuts',
    },
    {
      combo: { key: 'escape' },
      handler: handleEscape,
      description: 'Close / deselect',
    },
  ], [selectedCredentialId, showAddForm, showShortcutsHelp, showCommandPalette, showEmergencyKitModal]);

  useKeyboardShortcuts(shortcuts);

  const renderContent = () => {
    if (sidebarView === 'generator') {
      return (
        <div className="h-full overflow-y-auto p-4 sm:p-6" role="main" aria-label="Password generator">
          <div className="max-w-md mx-auto">
            <PasswordGenerator standalone />
          </div>
        </div>
      );
    }

    if (sidebarView === 'settings') {
      return (
        <div className="h-full overflow-y-auto" role="main" aria-label="Settings">
          <Settings />
        </div>
      );
    }

    if (sidebarView === 'aliases') {
      return (
        <div className="h-full overflow-y-auto p-4 sm:p-6" role="main" aria-label="Email Aliases">
          <div className="max-w-2xl mx-auto">
            <EmailAliases />
          </div>
        </div>
      );
    }

    if (sidebarView === 'health') {
      return (
        <div className="h-full overflow-y-auto" role="main" aria-label="Password Health">
          <PasswordHealth />
        </div>
      );
    }

    if (sidebarView === 'authenticator') {
      return (
        <div className="h-full overflow-hidden" role="main" aria-label="Authenticator Hub">
          <AuthenticatorHub />
        </div>
      );
    }

    if (sidebarView === 'share') {
      return (
        <div className="h-full overflow-y-auto" role="main" aria-label="Secure Share">
          <SecureShare />
        </div>
      );
    }

    return (
      <div className="h-full flex" role="main">
        <div className={`${
          selectedCredential ? 'hidden md:block md:w-96' : 'w-full'
        } h-full border-r border-white/5 overflow-y-auto shrink-0`} aria-label="Credential list">
          <CredentialList />
        </div>

        {selectedCredential ? (
          <div className="flex-1 h-full overflow-hidden" aria-label="Credential details">
            <CredentialDetail credential={selectedCredential} />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-700" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-gray-500 mb-1">Select a credential</h3>
              <p className="text-sm text-gray-600">Choose an entry from the list to view details</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-600">
                <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px]">Ctrl+N</kbd>
                <span>New entry</span>
                <span className="mx-1">·</span>
                <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px]">Ctrl+K</kbd>
                <span>Search</span>
                <span className="mx-1">·</span>
                <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px]">/</kbd>
                <span>Shortcuts</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-white/5 px-3 sm:px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={() => setShowMobileSidebar(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span className="font-bold text-sm text-white">SafeVault</span>

          {/* Health Score Pill */}
          <button
            onClick={() => { setSidebarView('health'); setSelectedCredential(null); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer"
            title="View Password Health & Security Audit"
          >
            {healthBadge.weakCount > 0 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 font-bold">{healthBadge.weakCount} weak</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 font-bold">{healthBadge.score}%</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCommandPalette(true)}
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Smart Search (Ctrl+K)"
            title="Smart Search & Actions (Ctrl+K)"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={handleAddCredential}
            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors cursor-pointer"
            aria-label="Add new credential"
            title="Add Credential"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileSidebar(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 bottom-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="relative h-full">
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="absolute top-4 right-[-40px] p-2 text-white"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
              <div onClick={() => setShowMobileSidebar(false)}>
                <Sidebar onAddCredential={handleAddCredential} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar onAddCredential={handleAddCredential} />
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full pt-14 md:pt-0 overflow-hidden flex flex-col">
        {checkForUpdates && !networkApprovedThisSession && (
          <div className="bg-amber-600/20 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <span>SafeVault is requesting temporary network access to check for updates. Do you allow this connection for this session?</span>
            <div className="flex gap-2">
              <button 
                onClick={approveNetworkThisSession}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1 rounded transition-colors"
              >
                Allow Once
              </button>
            </div>
          </div>
        )}
        {updateAvailable && (
          <div className="bg-emerald-600/20 border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300">
            <span>A new update <strong>({updateAvailable})</strong> is available with new features and fixes!</span>
            <button 
              onClick={() => setShowUpdateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1 rounded transition-colors"
            >
              View Release Notes
            </button>
          </div>
        )}
        <div className={`flex-1 overflow-hidden ${isExtension ? 'pb-14' : 'pb-16 md:pb-0'}`}>
          {renderContent()}
        </div>
      </div>

      {/* Universal Mobile & Extension Bottom Navigation Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-md border-t border-white/10 px-2 py-1.5 items-center justify-around ${
        isExtension ? 'flex' : 'flex md:hidden'
      }`}>
        <button
          onClick={() => { setSidebarView('all'); setSelectedCredential(null); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            sidebarView === 'all' || sidebarView === 'favorites' || sidebarView === 'cards' ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Vault</span>
        </button>

        <button
          onClick={() => { setSidebarView('authenticator'); setSelectedCredential(null); }}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            sidebarView === 'authenticator' ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>2FA Hub</span>
          {totpCount > 0 && (
            <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => { setSidebarView('aliases'); setSelectedCredential(null); }}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            sidebarView === 'aliases' ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Aliases</span>
          {aliasCount > 0 && (
            <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-blue-400" />
          )}
        </button>

        <button
          onClick={() => { setSidebarView('generator'); setSelectedCredential(null); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            sidebarView === 'generator' ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Generator</span>
        </button>

        <button
          onClick={() => { setSidebarView('settings'); setSelectedCredential(null); }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            sidebarView === 'settings' ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Smart Command Palette (Omnipresent Fuzzy Search & Quick Actions) */}
      <SmartCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenAddModal={handleAddCredential}
        onOpenEmergencyKit={() => setShowEmergencyKitModal(true)}
      />

      {/* Emergency Kit Modal */}
      <EmergencyKitModal
        isOpen={showEmergencyKitModal}
        onClose={() => setShowEmergencyKitModal(false)}
      />

      {/* Add/Edit Credential Modal */}
      {showAddForm && (
        <CredentialForm onClose={() => setShowAddForm(false)} />
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && <PrivacyPolicy />}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowShortcutsHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Keyboard className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2">
              {SHORTCUT_DESCRIPTIONS.map(({ combo, description }) => (
                <div key={combo} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-300">{description}</span>
                  <kbd className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-xs text-emerald-400 font-mono">
                    {combo}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
              aria-label="Close shortcuts"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {updateAvailable && showUpdateModal && (
        <UpdateModal onClose={() => setShowUpdateModal(false)} />
      )}
    </div>
  );
}
