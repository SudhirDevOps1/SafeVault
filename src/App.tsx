import { useEffect } from 'react';
import { useVaultStore } from '@/stores/vaultStore';
import VaultSetup from '@/components/VaultSetup';
import VaultUnlock from '@/components/VaultUnlock';
import Dashboard from '@/components/Dashboard';
import PrivacyPolicy from '@/components/PrivacyPolicy';
import { Shield } from 'lucide-react';

export default function App() {
  const { vaultState, showPrivacyPolicy, initializeVault } = useVaultStore();

  useEffect(() => {
    initializeVault();
  }, [initializeVault]);

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
