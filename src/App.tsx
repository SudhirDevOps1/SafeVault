import { useEffect } from 'react';
import { useVaultStore } from '@/stores/vaultStore';
import VaultSetup from '@/components/VaultSetup';
import VaultUnlock from '@/components/VaultUnlock';
import Dashboard from '@/components/Dashboard';
import PrivacyPolicy from '@/components/PrivacyPolicy';
import { Shield } from 'lucide-react';

export default function App() {
  const { vaultState, showPrivacyPolicy, initializeVault, lockVault, addAuditLog } = useVaultStore();

  useEffect(() => {
    initializeVault();
  }, [initializeVault]);

  // ── Privacy: Lock vault when tab/app goes to background ───────────────────
  useEffect(() => {
    // Web / Browser: Page Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden && vaultState === 'unlocked') {
        addAuditLog('AUTO_LOCK', 'Vault locked — tab became hidden (Page Visibility API)');
        lockVault();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Mobile / Capacitor: App state change (runtime-only on Android — silently ignored in web/Electron)
    let capacitorCleanup: (() => void) | null = null;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — @capacitor/app is a runtime dependency available on Android only
        const { App: CapApp } = await import(/* @vite-ignore */ '@capacitor/app');
        const handle = await CapApp.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (!state.isActive && vaultState === 'unlocked') {
            addAuditLog('AUTO_LOCK', 'Vault locked — app went to background (Capacitor)');
            lockVault();
          }
        });
        capacitorCleanup = () => handle.remove();
      } catch {
        // Not running on Capacitor — ignore silently
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      capacitorCleanup?.();
    };
  }, [vaultState, lockVault, addAuditLog]);

  // Loading state
  if (vaultState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <>
      {vaultState === 'setup' && <VaultSetup />}
      {vaultState === 'locked' && <VaultUnlock />}
      {vaultState === 'unlocked' && <Dashboard />}
      {showPrivacyPolicy && vaultState === 'setup' && <PrivacyPolicy />}
    </>
  );
}
