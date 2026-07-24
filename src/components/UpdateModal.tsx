import { useState, useEffect } from 'react';
import { Download, AlertTriangle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { logger } from '@/utils/logger';

interface UpdateModalProps {
  onClose: () => void;
}

export default function UpdateModal({ onClose }: UpdateModalProps) {
  const {
    updateAvailable,
    updateReleaseNotes,
    updateAssets,
    updateDownloadUrl,
  } = useVaultStore();

  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const isElectron = typeof window !== 'undefined' && 'safevault' in window && (window as any).safevault?.isElectron;

  // Find Windows exe setup asset
  const windowsSetupAsset = updateAssets.find(
    (asset) => asset.name.toLowerCase().endsWith('.exe') && asset.name.toLowerCase().includes('setup')
  ) || updateAssets.find((asset) => asset.name.toLowerCase().endsWith('.exe'));

  useEffect(() => {
    if (!isElectron) return;

    // Listen to download progress events from Electron Main Process
    const removeListener = (window as any).safevault.onUpdateProgress((percent: number) => {
      setDownloadProgress(percent);
      if (percent >= 100) {
        setDownloadSuccess(true);
      }
    });

    return () => {
      removeListener();
    };
  }, [isElectron]);

  const handleUpdateNow = async () => {
    if (!isElectron || !windowsSetupAsset) {
      // Fallback: Open release URL
      window.open(updateDownloadUrl || 'https://github.com/SudhirDevOps1/SafeVault/releases/latest', '_blank');
      return;
    }

    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      logger.info(`Starting automatic download for update asset: ${windowsSetupAsset.name}`);
      const res = await (window as any).safevault.downloadAndInstallUpdate(windowsSetupAsset.browser_download_url);
      if (!res.success) {
        setDownloadError(res.error || 'Failed to download installer.');
        setDownloadProgress(null);
      }
    } catch (err: any) {
      logger.error('Failed to trigger update installation', err);
      setDownloadError(err.message || 'An unexpected error occurred.');
      setDownloadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col max-h-[90vh]">
        
        {/* Banner Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600"></div>

        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-white/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Release Update
              </span>
              <span className="text-gray-500 text-xs">SafeVault Latest</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🚀 Version {updateAvailable} is Ready!
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close updates modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Release Notes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              What's New & Fixes
            </span>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-xs text-gray-300 leading-relaxed max-h-[30vh] overflow-y-auto space-y-2 select-text whitespace-pre-wrap font-sans">
              {updateReleaseNotes}
            </div>
          </div>

          {/* Desktop Installer Info */}
          {isElectron && windowsSetupAsset && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-semibold text-white block">One-Click Auto Update</span>
                <p className="text-[11px] text-gray-400 leading-normal">
                  Pressing "Update Now" will automatically download the installer, close the app, uninstall the current version, and launch the setup for the new version.
                </p>
              </div>
            </div>
          )}

          {/* Status Displays */}
          {downloadProgress !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {downloadSuccess ? 'Preparing installation...' : 'Downloading update assets...'}
                </span>
                <span className="text-white">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {downloadError && (
            <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-4 flex gap-3 items-start text-xs text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Download Failed</span>
                <p className="leading-normal">{downloadError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-white/5 flex justify-end gap-3 bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Remind Me Later
          </button>
          
          <button
            type="button"
            onClick={handleUpdateNow}
            disabled={downloadProgress !== null}
            className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            {isElectron && windowsSetupAsset ? 'Update Now' : 'Download Now'}
          </button>
        </div>

      </div>
    </div>
  );
}
