import { Shield, Download, Lock, Terminal, Cpu } from 'lucide-react';

export default function WebShowcase() {
  const APP_VERSION = '1.1.2';
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
  let detectedOS = 'Windows';
  let directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault%20Setup%20${APP_VERSION}.exe`;
  
  if (userAgent.includes('mac')) {
    detectedOS = 'macOS';
    directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault-${APP_VERSION}.dmg`;
  } else if (userAgent.includes('linux')) {
    detectedOS = 'Linux';
    directUrl = `https://github.com/SudhirDevOps1/SafeVault/releases/download/v${APP_VERSION}/SafeVault-${APP_VERSION}.AppImage`;
  }

  const features = [
    {
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      title: "AES-GCM 256-Bit Cryptography",
      description: "Keys derived securely via PBKDF2 with 600K iterations directly in your browser. Your master password never leaves your memory."
    },
    {
      icon: <Cpu className="w-5 h-5 text-emerald-400" />,
      title: "100% Offline-First Database",
      description: "Runs entirely locally inside your browser's sandboxed IndexedDB or your native app client. Zero silent remote database sync."
    },
    {
      icon: <Shield className="w-5 h-5 text-emerald-400" />,
      title: "Zero-Knowledge Password Auditing",
      description: "Audit stored passwords securely against database breach lists using k-Anonymity protocols. No full password hashes are ever sent."
    },
    {
      icon: <Terminal className="w-5 h-5 text-emerald-400" />,
      title: "Interactive CLI Companion",
      description: "Search, add, and generate credentials dynamically from your terminal. Autolinks to your OS environment PATH out of the box."
    }
  ];

  return (
    <div className="flex flex-col h-full justify-between gap-12">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">SafeVault</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Zero-Knowledge Offline Vault</p>
          </div>
        </div>

        <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
          Safeguard your digital keys, <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">completely offline.</span>
        </h2>
        <p className="text-gray-400 text-sm max-w-lg leading-relaxed mb-8">
          SafeVault is a privacy-first credentials manager designed to work strictly on your local device. 
          Get the desktop application for optimized offline performance, system-level safety features, and terminal access.
        </p>

        {/* Feature List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          {features.map((feature, idx) => (
            <div key={idx} className="flex gap-4 p-4 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-all duration-150">
              <div className="shrink-0 mt-0.5">{feature.icon}</div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download Action Area */}
      <div className="p-5 bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 border border-emerald-500/15 rounded-2xl max-w-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Download Desktop Client</h3>
            </div>
            <p className="text-xs text-gray-400">Get native wrappers with clipboard scrubbing & anti-screenshot security</p>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex flex-col gap-1.5">
            <a
              href={directUrl}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold text-center transition-all shadow-lg shadow-emerald-600/10"
            >
              Download for {detectedOS} (v{APP_VERSION})
            </a>
            
            <div className="flex items-center justify-between gap-1 text-[10px] text-gray-500 px-1">
              <span>Alternative Platforms:</span>
              <a
                href="https://github.com/SudhirDevOps1/SafeVault/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                View all releases
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between text-xs text-gray-600 border-t border-white/5 pt-4">
        <span>Crafted securely by <strong>Sudhir Singh</strong></span>
        <span>Version {APP_VERSION}</span>
      </div>
    </div>
  );
}
