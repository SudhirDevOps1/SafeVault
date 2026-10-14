import { useRef } from 'react';
import { ShieldCheck, Printer, X, AlertTriangle, Key, Lock, FileText, CheckCircle2 } from 'lucide-react';

interface EmergencyKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryPhrase?: string;
  vaultId?: string;
  createdAt?: number;
}

export default function EmergencyKitModal({
  isOpen,
  onClose,
  recoveryPhrase,
  vaultId,
  createdAt,
}: EmergencyKitModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const words = recoveryPhrase ? recoveryPhrase.trim().split(/\s+/) : [];
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      {/* Print-specific style injection to guarantee only the Emergency Kit prints */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #safevault-emergency-kit-sheet, #safevault-emergency-kit-sheet * {
            visibility: visible !important;
          }
          #safevault-emergency-kit-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            padding: 24px !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Topbar (Screen only) */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gray-950 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">SafeVault Emergency Kit</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Kit</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Kit Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white text-gray-950 font-sans" id="safevault-emergency-kit-sheet" ref={printRef}>
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-950 text-white flex items-center justify-center font-black text-base">
                  S
                </div>
                <h1 className="text-2xl font-black tracking-tight text-gray-950">SafeVault</h1>
              </div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mt-1">
                Zero-Knowledge Emergency Recovery Kit
              </p>
            </div>

            <div className="text-right text-[11px] text-gray-600">
              <p><span className="font-bold text-gray-900">Generated:</span> {formattedDate}</p>
              {vaultId && (
                <p className="font-mono text-[10px] mt-0.5">
                  <span className="font-bold text-gray-900">Vault ID:</span> {vaultId.slice(0, 16)}...
                </p>
              )}
              <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded border border-emerald-300">
                AES-256-GCM / BIP-39
              </span>
            </div>
          </div>

          {/* Critical Warning Box */}
          <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-lg mb-5 text-xs leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Keep this document confidential and physically secure</span>
            </div>
            <p>
              Anyone with access to this sheet and your credentials could access your digital vault. Store it in a locked safe, safety deposit box, or with a trusted family member.
            </p>
          </div>

          {/* Section 1: Master Password */}
          <div className="mb-5 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                1. Master Password
              </h2>
            </div>
            <p className="text-[11px] text-gray-600 mb-3">
              Write down your Master Password below in handwriting. Never store it unencrypted on any computer or cloud drive.
            </p>
            <div className="border-b-2 border-dashed border-gray-400 py-3 px-2 bg-white rounded font-mono text-xs text-gray-400 tracking-wider">
              Write your Master Password here: ____________________________________________________
            </div>
          </div>

          {/* Section 2: 24-Word Emergency Recovery Phrase */}
          <div className="mb-5 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                2. 24-Word Emergency Recovery Phrase
              </h2>
            </div>
            <p className="text-[11px] text-gray-600 mb-3">
              This BIP-39 cryptographic mnemonic mathematically unwraps your vault key even if you completely forget your Master Password.
            </p>

            {words.length === 24 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-gray-200">
                {words.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-mono py-1 px-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-[10px] text-gray-400 w-4 font-bold">{idx + 1}.</span>
                    <span className="font-bold text-gray-900">{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-gray-200">
                {Array.from({ length: 24 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-mono py-1 px-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-[10px] text-gray-400 w-4 font-bold">{idx + 1}.</span>
                    <span className="text-gray-300">____________</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Recovery Instructions */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                3. How to Restore Your Vault
              </h2>
            </div>
            <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Launch the SafeVault application or open the browser extension.</li>
              <li>On the unlock screen, select <strong className="text-gray-900">Unlock using Recovery Phrase</strong>.</li>
              <li>Carefully enter the 24 words above separated by spaces.</li>
              <li>Your encrypted master key will unwrap locally on your device. Set a new Master Password immediately in Settings.</li>
            </ol>
          </div>

          {/* Footer Quality / Zero Knowledge Stamp */}
          <div className="pt-3 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>SafeVault Zero-Knowledge Cryptography · 100% Free & Open Source</span>
            </div>
            <p>Page 1 of 1 · Physical Archive Copy</p>
          </div>
        </div>

        {/* Modal Bottom Bar (Screen only) */}
        <div className="p-4 border-t border-white/10 bg-gray-950 flex items-center justify-between no-print">
          <p className="text-xs text-gray-400">
            Click <strong>Print Kit</strong> to produce a permanent paper backup.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
