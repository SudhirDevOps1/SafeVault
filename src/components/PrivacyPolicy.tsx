import { Shield, X } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';

export default function PrivacyPolicy() {
  const { setShowPrivacyPolicy } = useVaultStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
          </div>
          <button
            onClick={() => setShowPrivacyPolicy(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 space-y-5 text-gray-300 text-sm leading-relaxed max-h-[calc(85vh-130px)]">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-emerald-400 font-semibold text-base">
              🔐 SafeVault is a zero-knowledge, offline-first credential manager.
            </p>
          </div>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">No Data Transmission</h3>
            <p>SafeVault never transmits any of your data over the network. All credentials, passwords, TOTP secrets, and notes remain on your device at all times. There are no servers, no cloud sync, and no remote storage.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">No Analytics or Telemetry</h3>
            <p>SafeVault does not collect any usage data, analytics, crash reports, or telemetry of any kind. No third-party tracking scripts are loaded. No external CDN calls are made.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">Local Encryption</h3>
            <p>All encryption and decryption happens locally on your device using industry-standard algorithms (AES-GCM 256-bit with PBKDF2 key derivation at 600,000+ iterations). Your master password is never stored — only a verification hash is kept to confirm your identity.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">Zero-Knowledge Architecture</h3>
            <p>The developers of SafeVault cannot access your data under any circumstances. We have no ability to recover your master password or decrypt your vault. You are the sole custodian of your data.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">Your Responsibility</h3>
            <p>You are solely responsible for:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Remembering your master password (it cannot be recovered)</li>
              <li>Creating regular encrypted backups of your vault</li>
              <li>Keeping your device secure and up to date</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">Open & Transparent</h3>
            <p>SafeVault's security model is based on well-established cryptographic standards. All encryption operations use the Web Crypto API, ensuring reliable and auditable security.</p>
          </section>
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 px-6 py-4">
          <button
            onClick={() => {
              localStorage.setItem('safevault_privacy_seen', 'true');
              setShowPrivacyPolicy(false);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
}
