import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle, Shield, Key } from 'lucide-react';
import { useVaultStore } from '../stores/vaultStore';

export default function LocalSync() {
  const { credentials, mergeCredentials } = useVaultStore();
  const [isElectronApp] = useState(() => typeof window !== 'undefined' && 'safevault' in window);

  // Server State (Desktop Only)
  const [isServerActive, setIsServerActive] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ ips: string[]; port: number; pin: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Client State (Mobile / Web)
  const [targetIP, setTargetIP] = useState('');
  const [pairingPIN, setPairingPIN] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientStatus, setClientStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Listen to Server Sync requests (Desktop Only)
  useEffect(() => {
    if (!isElectronApp || !isServerActive) return;

    // Register preload callback
    const unsubscribe = (window as any).safevault.onSyncRequest((clientVault: any[], respond: (err: any, merged: any[]) => void) => {
      setSyncStatus('Pairing requested...');
      
      // Perform local database merge
      mergeCredentials(clientVault)
        .then((mergedData) => {
          // Send merged data back to the client
          respond(null, mergedData);
          setSyncStatus('Synchronization successful!');
          setTimeout(() => setSyncStatus(null), 5000);
        })
        .catch((err) => {
          respond(err, []);
          setSyncStatus('Synchronization failed during data merge');
          setTimeout(() => setSyncStatus(null), 5000);
        });
    });

    return () => {
      unsubscribe();
    };
  }, [isElectronApp, isServerActive, mergeCredentials]);

  // Clean up server on unmount
  useEffect(() => {
    return () => {
      if (isElectronApp && isServerActive) {
        (window as any).safevault.stopSyncServer();
      }
    };
  }, [isElectronApp, isServerActive]);

  const handleStartServer = async () => {
    try {
      setSyncStatus(null);
      const info = await (window as any).safevault.startSyncServer(credentials);
      setServerInfo(info);
      setIsServerActive(true);
    } catch (e) {
      setSyncStatus('Failed to start sync server');
    }
  };

  const handleStopServer = async () => {
    try {
      await (window as any).safevault.stopSyncServer();
      setIsServerActive(false);
      setServerInfo(null);
      setSyncStatus(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClientSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIP || !pairingPIN) {
      setClientStatus({ type: 'error', message: 'Please fill in both target IP and 6-digit PIN' });
      return;
    }

    setClientLoading(true);
    setClientStatus(null);

    // Format IP with protocol and port if not specified
    let url = targetIP.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    if (!url.includes(':')) {
      url = url + ':58241';
    }
    url = url + '/sync';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-PIN': pairingPIN.trim()
        },
        body: JSON.stringify({ vault: credentials })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.vault)) {
        await mergeCredentials(resData.vault);
        setClientStatus({
          type: 'success',
          message: `Synchronization successful! Merged ${resData.vault.length} records.`
        });
      } else {
        throw new Error('Invalid vault response from server');
      }
    } catch (err: any) {
      setClientStatus({
        type: 'error',
        message: err.message || 'Connection failed. Verify Wi-Fi network and pairing PIN.'
      });
    } finally {
      setClientLoading(false);
    }
  };

  return (
    <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
          <Wifi className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Local Wi-Fi Sync</h3>
          <p className="text-xs text-gray-400">Synchronize your encrypted vault safely over local Wi-Fi networks.</p>
        </div>
      </div>

      {isElectronApp ? (
        /* Host/Server View (Electron App) */
        <div className="space-y-6">
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-white">Pairing Host Status</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {isServerActive ? 'Hosting active sync channel...' : 'Start server to pair with mobile or web.'}
              </p>
            </div>
            <button
              onClick={isServerActive ? handleStopServer : handleStartServer}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                isServerActive
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {isServerActive ? 'Stop Sync Server' : 'Start Sync Server'}
            </button>
          </div>

          {isServerActive && serverInfo && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">1. IP Addresses</span>
                  <div className="mt-2 space-y-1">
                    {serverInfo.ips.map(ip => (
                      <code key={ip} className="block text-sm text-emerald-400 font-mono">
                        {ip}:{serverInfo.port}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">2. Pairing PIN</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span className="text-2xl font-black text-white font-mono tracking-widest">{serverInfo.pin}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">Enter this 6-digit code on the connecting device.</p>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300 leading-normal">
                  <strong>Strict Security Active:</strong> The sync session is locked behind this code. Only clients with this exact PIN can connect.
                </p>
              </div>
            </div>
          )}

          {syncStatus && (
            <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex items-center gap-2 text-xs text-gray-300">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>{syncStatus}</span>
            </div>
          )}
        </div>
      ) : (
        /* Client View (Mobile/Web Browser) */
        <form onSubmit={handleClientSync} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">Target IP Address</label>
            <input
              type="text"
              placeholder="e.g., 192.168.1.100"
              value={targetIP}
              onChange={e => setTargetIP(e.target.value)}
              disabled={clientLoading}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">6-Digit Pairing PIN</label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g., 382914"
              value={pairingPIN}
              onChange={e => setPairingPIN(e.target.value.replace(/\D/g, ''))}
              disabled={clientLoading}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={clientLoading}
            className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clientLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Synchronizing...
              </>
            ) : (
              'Initiate Pairing & Sync'
            )}
          </button>

          {clientStatus && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                clientStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {clientStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-normal">{clientStatus.message}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
