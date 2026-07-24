import React, { useState, useEffect, useRef } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle, Key, QrCode, Camera, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useVaultStore } from '../stores/vaultStore';
import { encrypt, decrypt, deriveKeyArgon2id, createVerificationHashArgon2id } from '../utils/crypto';

export default function LocalSync() {
  const { credentials, mergeCredentials, strictOfflineMode } = useVaultStore();
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

  // Cloud Relay State
  const [syncMode, setSyncMode] = useState<'wifi' | 'relay'>('wifi');
  const [relayChannel, setRelayChannel] = useState('');
  const [relayPIN, setRelayPIN] = useState('');
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRelayPush = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!relayChannel || !relayPIN) {
      setRelayStatus({ type: 'error', message: 'Please enter both a Channel ID and a 6-digit PIN' });
      return;
    }
    setRelayLoading(true);
    setRelayStatus(null);
    try {
      // Derive a secure key from the PIN and Channel ID using Argon2id
      const salt = await createVerificationHashArgon2id(relayChannel, 'safevault-relay-salt');
      const cryptoKey = await deriveKeyArgon2id(relayPIN, salt.slice(0, 16));
      
      // Encrypt the vault
      const vaultJson = JSON.stringify(credentials);
      const { ciphertext, iv } = await encrypt(vaultJson, cryptoKey);
      
      // Push to open-source Cloudflare Workers KV relay
      const payload = { ciphertext, iv };
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Failed to push data to relay server');
      
      setRelayStatus({
        type: 'success',
        message: 'Vault successfully encrypted and pushed to relay channel! Now press "Pull & Merge" on the other device.'
      });
    } catch (err: any) {
      setRelayStatus({ type: 'error', message: err.message || 'Push failed. Please check network connection.' });
    } finally {
      setRelayLoading(false);
    }
  };

  const handleRelayPull = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!relayChannel || !relayPIN) {
      setRelayStatus({ type: 'error', message: 'Please enter both a Channel ID and a 6-digit PIN' });
      return;
    }
    setRelayLoading(true);
    setRelayStatus(null);
    try {
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`);
      if (!response.ok) throw new Error('No vault data found in this channel. Ensure the sending device pushed first.');
      
      const payload = await response.json();
      
      // Derive the same key
      const salt = await createVerificationHashArgon2id(relayChannel, 'safevault-relay-salt');
      const cryptoKey = await deriveKeyArgon2id(relayPIN, salt.slice(0, 16));
      
      // Decrypt the vault
      const decryptedJson = await decrypt(payload.ciphertext, payload.iv, cryptoKey);
      const incomingVault = JSON.parse(decryptedJson);
      
      if (incomingVault && Array.isArray(incomingVault)) {
        await mergeCredentials(incomingVault);
        setRelayStatus({
          type: 'success',
          message: `Vault successfully downloaded, decrypted, and merged ${incomingVault.length} records!`
        });
      } else {
        throw new Error('Invalid decrypted data format');
      }
    } catch (err: any) {
      setRelayStatus({ type: 'error', message: err.message || 'Decryption/Pull failed. Verify PIN and Channel ID.' });
    } finally {
      setRelayLoading(false);
    }
  };

  const [discovering, setDiscovering] = useState(false);

  const handleAutoDiscover = async () => {
    setDiscovering(true);
    setClientStatus({ type: 'success', message: 'Scanning local network subnets for SafeVault Sync Server...' });
    
    // Subnets to scan
    const subnets = [
      '192.168.1',
      '192.168.0',
      '192.168.2',
      '192.168.31',
      '192.168.68',
      '192.168.50',
      '10.0.0'
    ];
    
    // If targetIP has a value, extract its subnet prefix and prepend it to the list
    if (targetIP) {
      const match = targetIP.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (match && !subnets.includes(match[1])) {
        subnets.unshift(match[1]);
      }
    }
    
    let foundIP: string | null = null;
    
    for (const subnet of subnets) {
      try {
        const promises = [];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 750);
        
        for (let i = 1; i <= 254; i++) {
          const ip = `${subnet}.${i}`;
          const promise = fetch(`http://${ip}:58241/`, {
            method: 'GET',
            signal: controller.signal,
          })
            .then(async (res) => {
              if (res.status === 404) {
                // Confirm it is indeed SafeVault by checking the JSON payload
                const data = await res.json().catch(() => ({}));
                if (data.error === 'Not Found') {
                  return ip;
                }
              }
              return null;
            })
            .catch(() => null);
          promises.push(promise);
        }
        
        const results = await Promise.all(promises);
        clearTimeout(timeoutId);
        foundIP = results.find(ip => ip !== null) || null;
        
        if (foundIP) {
          break;
        }
      } catch (e) {
        // Ignore subnet errors
      }
    }
    
    if (foundIP) {
      setTargetIP(`${foundIP}:58241`);
      setClientStatus({
        type: 'success',
        message: `Found SafeVault Sync Server at ${foundIP}:58241! Please enter the 6-digit PIN and press Sync.`
      });
    } else {
      setClientStatus({
        type: 'error',
        message: 'Could not auto-discover sync server. Please verify Wi-Fi connection, ensure the sync server is running on the host, or scan the QR Code instead.'
      });
    }
    setDiscovering(false);
  };

  // Helper to derive AES-256 key from PIN locally in browser (E2EE Wi-Fi Sync)
  const deriveWifiPINKey = async (pin: string): Promise<CryptoKey> => {
    const pinKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('safevault-sync-salt'),
        iterations: 10000,
        hash: 'SHA-256'
      },
      pinKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
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
      // Derive local E2EE key from pairing PIN
      const aesKey = await deriveWifiPINKey(pairingPIN.trim());
      
      // Encrypt the vault payload before sending
      const vaultJson = JSON.stringify(credentials);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(vaultJson);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        dataBuffer
      );
      
      const buffer = new Uint8Array(encrypted);
      const ivBase64 = window.btoa(String.fromCharCode(...iv));
      
      // Concatenate tag parsing (last 16 bytes is Auth Tag in Web Crypto API)
      const tagOffset = buffer.length - 16;
      const ciphertextBytes = buffer.slice(0, tagOffset);
      const tagBytes = buffer.slice(tagOffset);
      
      const payload = {
        ciphertext: window.btoa(String.fromCharCode(...ciphertextBytes)),
        iv: ivBase64,
        tag: window.btoa(String.fromCharCode(...tagBytes))
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-PIN': pairingPIN.trim()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success && resData.encrypted) {
        // Decrypt the server response
        const resCiphertext = new Uint8Array(
          atob(resData.encrypted.ciphertext).split('').map(c => c.charCodeAt(0))
        );
        const resIv = new Uint8Array(
          atob(resData.encrypted.iv).split('').map(c => c.charCodeAt(0))
        );
        const resTag = new Uint8Array(
          atob(resData.encrypted.tag).split('').map(c => c.charCodeAt(0))
        );
        
        // Concatenate ciphertext and tag for Web Crypto
        const combined = new Uint8Array(resCiphertext.length + resTag.length);
        combined.set(resCiphertext);
        combined.set(resTag, resCiphertext.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: resIv },
          aesKey,
          combined
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        const mergedVault = JSON.parse(decryptedJson);
        
        if (Array.isArray(mergedVault)) {
          await mergeCredentials(mergedVault);
          setClientStatus({
            type: 'success',
            message: `Synchronization successful! Merged ${mergedVault.length} records.`
          });
        } else {
          throw new Error('Invalid vault response from server');
        }
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
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">SafeVault Sync Center</h3>
            <p className="text-xs text-gray-400">Synchronize credentials securely across all devices.</p>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
        <button
          type="button"
          onClick={() => setSyncMode('wifi')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            syncMode === 'wifi'
              ? 'bg-emerald-500 text-slate-900 shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Local Wi-Fi (P2P)
        </button>
        <button
          type="button"
          onClick={() => setSyncMode('relay')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            syncMode === 'relay'
              ? 'bg-emerald-500 text-slate-900 shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Cloud Relay (E2EE)
        </button>
      </div>

      {syncMode === 'wifi' ? (
        /* Original Local Wi-Fi Sync View */
        isElectronApp ? (
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
                type="button"
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
                    type="button"
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setClientStatus(null); setShowScanner(true); }}
                  className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Scan QR Code
                </button>
                <button
                  type="button"
                  disabled={discovering}
                  onClick={handleAutoDiscover}
                  className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:bg-gray-800 disabled:text-gray-600 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {discovering ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                  {discovering ? 'Searching...' : 'Auto-Discover'}
                </button>
              </div>
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
        )
      ) : (
        /* Cloud Relay (E2EE) Sync View */
        strictOfflineMode ? (
          <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-3 text-center py-8">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <span className="text-sm font-bold text-rose-400 block">Cloud Sync Blocked</span>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-normal">
              Strict Offline Mode (Air-Gap) is active. All cloud relay network requests are blocked. 
              Please disable Strict Offline Mode in settings if you want to use cloud relay synchronization.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1.5">
              <span className="text-xs text-emerald-400 font-bold block">🔒 Zero-Knowledge Cloud Relay</span>
              <p className="text-[11px] text-gray-400 leading-normal">
                Sync devices directly across different networks (e.g. mobile to web) without running a local PC server. 
                Your data is encrypted locally using AES-GCM before leaving your device; not even the relay server can access your secrets.
              </p>
            </div>

            <form className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Sync Channel ID</label>
                <input
                  type="text"
                  placeholder="e.g., custom-vault-room"
                  value={relayChannel}
                  onChange={e => setRelayChannel(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">6-Digit E2EE Encryption PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g., 839210"
                  value={relayPIN}
                  onChange={e => setRelayPIN(e.target.value.replace(/\D/g, ''))}
                  disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={relayLoading}
                  onClick={() => handleRelayPush()}
                  className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {relayLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Push Encrypted
                </button>
                <button
                  type="button"
                  disabled={relayLoading}
                  onClick={() => handleRelayPull()}
                  className="py-3 bg-emerald-500 text-slate-900 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {relayLoading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-900" /> : null}
                  Pull & Merge
                </button>
              </div>

              {relayStatus && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    relayStatus.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
                >
                  {relayStatus.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-normal">{relayStatus.message}</span>
                </div>
              )}
            </form>
          </div>
        )
      )}
    </div>
  );
}
