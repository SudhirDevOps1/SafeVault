import { useState, useMemo } from 'react';
import {
  Share2, Eye, EyeOff, Download, FileText,
  RefreshCw, FolderSync
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { exportSharedVault, importSharedVault } from '@/utils/secureShare';

export default function SecureShare() {
  const { credentials, mergeCredentials } = useVaultStore();

  // Export Share State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sharePassword, setSharePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [showPassword, setShowPassword] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Import Share State
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importingState, setImportingState] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  // Auto-detect and filter logins vs cards for selection
  const shareableItems = useMemo(() => {
    return [...credentials].sort((a, b) => a.title.localeCompare(b.title));
  }, [credentials]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(shareableItems.map(c => c.id));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      setExportError('Please select at least one item to share.');
      return;
    }
    if (sharePassword.length < 12) {
      setExportError('Sharing password must be at least 12 characters.');
      return;
    }
    if (sharePassword !== confirmPassword) {
      setExportError('Passwords do not match.');
      return;
    }

    setExportError(null);
    setExportSuccessMsg(null);
    setExporting(true);

    try {
      const itemsToExport = credentials.filter(c => selectedIds.includes(c.id));
      const pkgString = await exportSharedVault(itemsToExport, sharePassword, expiryDays);

      const blob = new Blob([pkgString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safevault-package-${Date.now()}.svault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccessMsg(`Successfully generated E2EE .svault Package containing ${itemsToExport.length} credentials!`);
      // Reset form
      setSharePassword('');
      setConfirmPassword('');
      setSelectedIds([]);
    } catch (err: any) {
      setExportError(err.message || 'Failed to create share package.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImportError(null);
    setImportSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileContent) {
      setImportError('Please upload an .svault file.');
      return;
    }
    if (!importPassword) {
      setImportError('Please enter the package password.');
      return;
    }

    setImportError(null);
    setImportSuccessMsg(null);
    setImportingState(true);

    try {
      const result = await importSharedVault(fileContent, importPassword);
      if (result.isExpired) {
        setImportError('Import failed: This package has expired.');
        return;
      }

      await mergeCredentials(result.credentials);
      setImportSuccessMsg(`Successfully decrypted package and merged ${result.credentials.length} credentials into your vault!`);
      // Reset fields
      setSelectedFile(null);
      setFileContent('');
      setImportPassword('');
    } catch (err: any) {
      setImportError('Decryption failed. Incorrect password or corrupted package.');
    } finally {
      setImportingState(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* EXPORT VAULT CONTAINER */}
      <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Share2 className="w-5 h-5 text-emerald-400" /> Export Share Package (.svault)
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Select items to encrypt under a shared key using Argon2id + AES-GCM. Generates a secure offline file you can share anywhere.
        </p>

        {exportError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 rounded-xl">
            {exportError}
          </div>
        )}
        {exportSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 rounded-xl">
            {exportSuccessMsg}
          </div>
        )}

        {/* Selection Area */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-400">Select Items ({selectedIds.length} chosen)</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-emerald-400 hover:text-emerald-300 font-medium">All</button>
              <span className="text-gray-700">|</span>
              <button onClick={selectNone} className="text-emerald-400 hover:text-emerald-300 font-medium">None</button>
            </div>
          </div>

          <div className="border border-white/5 rounded-xl bg-black/20 p-2 max-h-40 overflow-y-auto space-y-1">
            {shareableItems.map(item => (
              <label key={item.id} className="flex items-center gap-3 p-1.5 hover:bg-white/5 rounded-md cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelectItem(item.id)}
                  className="rounded bg-white/5 border-white/10 text-emerald-500 focus:ring-emerald-500/30 w-3.5 h-3.5 accent-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white block truncate">{item.title}</span>
                  <span className="text-[10px] text-gray-500 truncate block">{item.username || item.category}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Passwords */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-bold block">Create Sharing Password (min 12 chars)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Secure package password..."
                value={sharePassword}
                onChange={e => setSharePassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-bold block">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password..."
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30"
            />
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label htmlFor="package-expiry" className="text-[10px] text-gray-400 font-bold block mb-1">Package Expiration</label>
              <select
                id="package-expiry"
                value={expiryDays}
                onChange={e => setExpiryDays(parseInt(e.target.value))}
                className="w-full bg-[#161616] border border-white/10 rounded-xl py-1.5 px-3 text-white text-xs"
              >
                <option value={1}>1 Day</option>
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={0}>Never Expire</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || selectedIds.length === 0}
              className="flex-[2] mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Generate Package (.svault)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* IMPORT VAULT CONTAINER */}
      <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FolderSync className="w-5 h-5 text-emerald-400" /> Import Share Package (.svault)
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Decrypt a received .svault package locally. The decryption key is derived strictly inside your browser/app and items are merged into your current database.
        </p>

        {importError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 rounded-xl">
            {importError}
          </div>
        )}
        {importSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 rounded-xl">
            {importSuccessMsg}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* File Picker */}
          <div className="border-2 border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500/30 transition-all" onClick={() => document.getElementById('import-svault-picker')?.click()}>
            <input
              type="file"
              id="import-svault-picker"
              accept=".svault"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileText className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-xs text-gray-300 font-semibold truncate max-w-[240px]">
              {selectedFile ? selectedFile.name : 'Choose or Drag .svault file'}
            </span>
            <span className="text-[10px] text-gray-600 mt-1">Accepts SafeVault packages</span>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-bold block">Enter Package Password</label>
            <div className="relative">
              <input
                type={showImportPassword ? 'text' : 'password'}
                placeholder="Enter password to decrypt..."
                value={importPassword}
                onChange={e => setImportPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30"
              />
              <button
                type="button"
                onClick={() => setShowImportPassword(!showImportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
              >
                {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importingState || !selectedFile || !importPassword}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            {importingState ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Decrypting & Merging...
              </>
            ) : (
              <>
                <FolderSync className="w-3.5 h-3.5" />
                Decrypt & Import package
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
