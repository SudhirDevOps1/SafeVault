import { Shield, X, AlertTriangle, Wifi, CheckCircle } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';

export default function PrivacyPolicy() {
  const { setShowPrivacyPolicy } = useVaultStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#121212]/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Privacy Policy & System Limitations</h2>
          </div>
          <button
            onClick={() => setShowPrivacyPolicy(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 text-gray-300 text-xs leading-relaxed flex-1">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
            <p className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              100% Free, Open-Source & Privacy-First (FOSS)
            </p>
            <p className="text-[11px] text-gray-400">
              SafeVault contains zero tracking scripts, zero diagnostics pings, and absolutely no telemetry. Your credentials never leave your local device memory.
            </p>
          </div>

          {/* Data Usage Section */}
          <section className="space-y-2">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider text-emerald-400">1. How Data is Used & Stored</h3>
            <p>
              All stored credentials, passwords, TOTP secrets, and notes are encrypted locally in your browser's IndexedDB database using **AES-256-GCM** encryption. The master key is derived on-the-fly in memory using **PBKDF2 with 600,000 iterations**. We collect zero user profiles, zero IP logs, and zero registration details.
            </p>
          </section>

          {/* Internet usage details */}
          <section className="space-y-2.5">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-emerald-400" />
              2. When is Internet / Network Actually Needed?
            </h3>
            <p>
              SafeVault operates fully offline by default. External network connections are initiated **ONLY** in the following specific scenarios:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 pl-1">
              <li>
                <strong className="text-gray-200">Website Logo Loading:</strong> Fetching high-quality website logos/favicons (queries the anonymous DuckDuckGo Icons API by sending *only* the site's domain name, never your credentials).
              </li>
              <li>
                <strong className="text-gray-200">Breach Scan (Security Audit):</strong> Verifying if passwords have been compromised (queries the HaveIBeenPwned API using the **k-Anonymity privacy protocol** where only the first 5 characters of the SHA-1 hash are sent).
              </li>
              <li>
                <strong className="text-gray-200">Local Wi-Fi Peer-to-Peer Sync:</strong> Transferring credentials between devices requires both devices to be connected to the same local Wi-Fi subnet.
              </li>
              <li>
                <strong className="text-gray-200">Check for App Updates:</strong> Toggling the startup update validation queries GitHub Releases API.
              </li>
            </ul>
            <p className="text-gray-400 bg-white/5 p-2 rounded-lg text-[10px]">
              <strong>Notice:</strong> All network triggers require explicit, transient user permission (granted via the startup consent banner) and can be disabled or skipped at any time.
            </p>
          </section>

          {/* Limitations Section */}
          <section className="space-y-2.5">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              3. Critical System Limitations
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-400 pl-1">
              <li>
                <strong className="text-gray-200">Master Password Recovery:</strong> Because SafeVault uses a zero-knowledge structure, we cannot recover your master password. If lost, your vault data is permanently unrecoverable.
              </li>
              <li>
                <strong className="text-gray-200">P2P Local Sync Subnet Restrictions:</strong> Local sync does not work over the global internet or across different subnets/firewalls. Devices must share the same local network subnet.
              </li>
              <li>
                <strong className="text-gray-200">HTTPS Mixed Content Limitations:</strong> Standard web browsers running the app over secure HTTPS connections cannot communicate with local HTTP sync server IPs due to browser security limitations. Sync works natively on Desktop clients and Mobile APK packages.
              </li>
            </ul>
          </section>
        </div>

        {/* Action Button */}
        <div className="bg-[#121212]/95 border-t border-white/5 px-6 py-4">
          <button
            onClick={() => {
              localStorage.setItem('safevault_privacy_seen', 'true');
              setShowPrivacyPolicy(false);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors text-xs"
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
}
