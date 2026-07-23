import React, { useState, useEffect, useRef } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle, Key, QrCode, Camera, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
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

  // Camera Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Listen to Server Sync requests (Desktop Only)
  useEffect(() => {
    if (!isElectronApp || !isServerActive) return;

    const unsubscribe = (window as any).safevault.onSyncRequest((clientVault: any[], respond: (err: any, merged: any[]) => void) => {
      setSyncStatus('Pairing requested...');
      
      mergeCredentials(clientVault)
        .then((mergedData) => {
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

  // Clean up server and scanner on unmount
  useEffect(() => {
    return () => {
      if (isElectronApp && isServerActive) {
        (window as any).safevault.stopSyncServer();
      }
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isElectronApp, isServerActive]);

  // Scanner initialization
  useEffect(() => {
    if (!showScanner) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current = null;
        }).catch(() => {});
      }
      return;
    }

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader-container');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (data.ip && data.pin) {
                setTargetIP(`${data.ip}:${data.port || 58241}`);
                setPairingPIN(data.pin);
                setClientStatus({ type: 'success', message: 'QR Code scanned successfully! Press Sync below.' });
                
                // Stop scanner
                html5QrCode.stop().then(() => {
                  setShowScanner(false);
                  scannerRef.current = null;
                }).catch(() => {});
              }
            } catch (err) {
              setClientStatus({ type: 'error', message: 'Invalid QR Code payload parsed' });
            }
          },
          () => {} // Silent errors during frame scans
        );
      } catch (err) {
        setClientStatus({ type: 'error', message: 'Failed to access camera permission' });
        setShowScanner(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [showScanner]);

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

  const handleClientSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!targetIP || !pairingPIN) {
      setClientStatus({ type: 'error', message: 'Please fill in both target IP and 6-digit PIN' });
      return;
    }

    setClientLoading(true);
    setClientStatus(null);

    let url = targetIP.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    if (!url.includes(':') && !url.replace('http://', '').replace('https://', '').includes(':')) {
      url = url + ':58241';
    }
    if (!url.endsWith('/sync')) {
      url = url + '/sync';
    }

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

  // Build the QR Code JSON value (Desktop Host)
  const getQRValue = () => {
    if (!serverInfo) return '';
    return JSON.stringify({
      ip: serverInfo.ips[0] || '127.0.0.1',
      port: serverInfo.port,
      pin: serverInfo.pin
    });
  };

  return (
    <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      <div className="flex items-center gap-3">
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
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-bold block">1. Network Details</span>
                  <div className="space-y-1">
                    {serverInfo.ips.map(ip => (
                      <code key={ip} className="block text-sm text-emerald-400 font-mono">
                        {ip}:{serverInfo.port}
                      </code>
                    ))}
                  </div>
                  <div className="pt-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold block">2. Security PIN</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span className="text-2xl font-black text-white font-mono tracking-widest">{serverInfo.pin}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-white rounded-xl border border-white/10">
                    <QRCodeSVG value={getQRValue()} size={110} bgColor="#ffffff" fgColor="#000000" includeMargin={false} />
                  </div>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    Scan QR code on your mobile app settings
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-300 leading-normal">
                    <strong>Windows Firewall Blocking Connection?</strong>
                    <p className="text-gray-400 mt-1">
                      If connection fails, open PowerShell as **Administrator** and run this command to allow the sync port:
                    </p>
                  </div>
                </div>
                <code className="block p-2 bg-black/40 border border-white/5 rounded-lg text-[10px] text-amber-200 font-mono select-all overflow-x-auto">
                  netsh advfirewall firewall add rule name="SafeVault Sync Server" dir=in action=allow protocol=TCP localport=58241
                </code>
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
        <div className="space-y-4">
          {showScanner ? (
            <div className="p-4 bg-black/60 border border-white/10 rounded-2xl relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Scan Host QR Code
                </span>
                <button
                  onClick={() => setShowScanner(false)}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-hidden rounded-xl bg-[#080808] border border-white/5 aspect-square relative">
                <div id="qr-reader-container" className="w-full h-full"></div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setClientStatus(null); setShowScanner(true); }}
              className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Scan QR Code to Pair
            </button>
          )}

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
                'Initiate Sync'
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
        </div>
      )}
    </div>
  );
}
