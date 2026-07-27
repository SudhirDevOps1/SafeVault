import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle, Key, QrCode, Camera, X, Clock, Copy, Shuffle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useVaultStore } from '../stores/vaultStore';
import { encrypt, decrypt, deriveKeyArgon2id, createVerificationHashArgon2id } from '../utils/crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Safe base64 helpers — loop-based, no spread stack overflows on large buffers
// ─────────────────────────────────────────────────────────────────────────────
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Format relative time for last sync display
function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

// Generate a random channel ID like "vault-a3f7-k9x2"
function generateChannelId(): string {
  const rand = () => Math.random().toString(36).slice(2, 6);
  return `vault-${rand()}-${rand()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LocalSync() {
  const { credentials, mergeCredentials, strictOfflineMode, lastSyncedAt, getSyncPayload } = useVaultStore();

  // FIX 6: Extension always defaults to Cloud Relay (has no Electron IPC)
  const isElectronApp = typeof window !== 'undefined' && 'safevault' in window;
  const defaultMode: 'wifi' | 'relay' = isElectronApp ? 'wifi' : 'relay';

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

  // FIX 3: Always read FRESH credentials on sync request (useRef to latest store value)
  const credentialsRef = useRef(credentials);
  useEffect(() => { credentialsRef.current = credentials; }, [credentials]);
  const getSyncPayloadRef = useRef(getSyncPayload);
  useEffect(() => { getSyncPayloadRef.current = getSyncPayload; }, [getSyncPayload]);

  // ── Server Sync Request Handler (Desktop Only) ──────────────────────────────
  useEffect(() => {
    if (!isElectronApp || !isServerActive || !serverInfo) return;

    const unsubscribe = (window as any).safevault.onSyncRequest(async (encryptedPayload: any, respond: (err: any, resPayload: any) => void) => {
      setSyncStatus('Pairing requested...');
      
      try {
        // 1. Derive local key from active server PIN
        const salt = await createVerificationHashArgon2id(serverInfo.pin, 'safevault-wifi-salt');
        const aesKey = await deriveWifiPINKey(serverInfo.pin, salt.slice(0, 16));

        // 2. Decrypt incoming client SyncPayload
        const resCiphertext = base64ToUint8Array(encryptedPayload.ciphertext);
        const resIv = base64ToUint8Array(encryptedPayload.iv);
        const resTag = base64ToUint8Array(encryptedPayload.tag);
        
        const combined = new Uint8Array(resCiphertext.length + resTag.length);
        combined.set(resCiphertext);
        combined.set(resTag, resCiphertext.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: resIv as any },
          aesKey,
          combined.buffer as ArrayBuffer
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        const clientPayload = JSON.parse(decryptedJson);

        // FIX 1: Support SyncPayload format (with deletedIds) or plain array (legacy)
        const clientCredentials = Array.isArray(clientPayload) ? clientPayload : (clientPayload.credentials ?? []);
        const clientDeletedIds: string[] = Array.isArray(clientPayload) ? [] : (clientPayload.deletedIds ?? []);

        if (!Array.isArray(clientCredentials)) {
          throw new Error('Decrypted client vault payload is not a valid list');
        }

        // 3. FIX 3: Merge with FRESH credentials (not stale closure)
        const mergedData = await mergeCredentials(clientCredentials, clientDeletedIds);

        // 4. Build response SyncPayload with updated tombstones
        const responseSyncPayload = getSyncPayloadRef.current();
        const responsePayload = {
          credentials: mergedData,
          deletedIds: responseSyncPayload.deletedIds,
          syncedAt: Date.now(),
        };

        const mergedJson = JSON.stringify(responsePayload);
        const encoder = new TextEncoder();
        const responseBuffer = encoder.encode(mergedJson);
        const respIv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedResponseBuffer = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: respIv },
          aesKey,
          responseBuffer
        );
        
        const respUint8 = new Uint8Array(encryptedResponseBuffer);
        const respIvBase64 = uint8ArrayToBase64(respIv);
        
        const respTagOffset = respUint8.length - 16;
        const respCiphertextBytes = respUint8.slice(0, respTagOffset);
        const respTagBytes = respUint8.slice(respTagOffset);
        
        respond(null, {
          ciphertext: uint8ArrayToBase64(respCiphertextBytes),
          iv: respIvBase64,
          tag: uint8ArrayToBase64(respTagBytes)
        });
        setSyncStatus('Synchronization successful!');
        setTimeout(() => setSyncStatus(null), 5000);
      } catch (err: any) {
        respond(err.message || 'Decryption/merge failed', null);
        setSyncStatus('Synchronization failed during E2EE decryption/merge');
        setTimeout(() => setSyncStatus(null), 5000);
      }
    });

    return () => { unsubscribe(); };
  }, [isElectronApp, isServerActive, serverInfo, mergeCredentials]);

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
        scannerRef.current.stop().then(() => { scannerRef.current = null; }).catch(() => {});
      }
      return;
    }

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader-container');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w, h) => { const s = Math.min(w, h) * 0.7; return { width: s, height: s }; } },
          (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (data.ip && data.pin) {
                setTargetIP(`${data.ip}:${data.port || 58241}`);
                setPairingPIN(data.pin);
                setClientStatus({ type: 'success', message: 'QR Code scanned! Press Sync below.' });
                html5QrCode.stop().then(() => { setShowScanner(false); scannerRef.current = null; }).catch(() => {});
              }
              // FIX 4: Also support Cloud Relay QR (channel + pin)
              if (data.channel && data.relayPin) {
                setSyncMode('relay');
                setRelayChannel(data.channel);
                setRelayPIN(data.relayPin);
                setClientStatus({ type: 'success', message: 'Cloud Relay QR scanned! Press Pull & Merge.' });
                html5QrCode.stop().then(() => { setShowScanner(false); scannerRef.current = null; }).catch(() => {});
              }
            } catch {
              setClientStatus({ type: 'error', message: 'Invalid QR Code payload' });
            }
          },
          () => {}
        );
      } catch {
        setClientStatus({ type: 'error', message: 'Failed to access camera permission' });
        setShowScanner(false);
      }
    };

    startScanner();
    return () => { if (scannerRef.current && scannerRef.current.isScanning) { scannerRef.current.stop().catch(() => {}); } };
  }, [showScanner]);

  const handleStartServer = async () => {
    try {
      setSyncStatus(null);
      // FIX 3: Pass fresh credentials at server start time
      const info = await (window as any).safevault.startSyncServer(credentialsRef.current);
      setServerInfo(info);
      setIsServerActive(true);
    } catch {
      setSyncStatus('Failed to start sync server');
    }
  };

  const handleStopServer = async () => {
    try {
      await (window as any).safevault.stopSyncServer();
      setIsServerActive(false);
      setServerInfo(null);
      setSyncStatus(null);
    } catch (e) { console.error(e); }
  };

  // ── Cloud Relay State ──────────────────────────────────────────────────────
  const [syncMode, setSyncMode] = useState<'wifi' | 'relay'>(defaultMode);
  const [relayChannel, setRelayChannel] = useState('');
  const [relayPIN, setRelayPIN] = useState('');
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // FIX 4: Auto-generate channel ID
  const handleGenerateChannel = useCallback(() => {
    setRelayChannel(generateChannelId());
  }, []);

  const copyRelayQR = useCallback(() => {
    if (!relayChannel || !relayPIN) return;
    const data = JSON.stringify({ channel: relayChannel, relayPin: relayPIN });
    navigator.clipboard.writeText(data).catch(() => {});
  }, [relayChannel, relayPIN]);

  const handleRelayPush = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!relayChannel || !relayPIN) {
      setRelayStatus({ type: 'error', message: 'Please enter both a Channel ID and a 6-digit PIN' });
      return;
    }
    setRelayLoading(true);
    setRelayStatus(null);
    try {
      const salt = await createVerificationHashArgon2id(relayChannel, 'safevault-relay-salt');
      const cryptoKey = await deriveKeyArgon2id(relayPIN, salt.slice(0, 16));
      
      // FIX 1: Send full SyncPayload (credentials + deletedIds) so remote gets tombstones
      const syncPayload = getSyncPayloadRef.current();
      const vaultJson = JSON.stringify(syncPayload);
      const { ciphertext, iv } = await encrypt(vaultJson, cryptoKey);
      
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Source': 'SafeVault' },
        body: JSON.stringify({ ciphertext, iv })
      });
      
      if (!response.ok) throw new Error('Failed to push data to relay server');
      setRelayStatus({ type: 'success', message: 'Vault encrypted and pushed to relay! Press "Pull & Merge" on the other device.' });
    } catch (err: any) {
      setRelayStatus({ type: 'error', message: err.message || 'Push failed. Check network connection.' });
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
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`, {
        headers: { 'X-Request-Source': 'SafeVault' }
      });
      if (!response.ok) throw new Error('No vault data found in this channel. Ensure the sending device pushed first.');
      
      const payload = await response.json();
      const salt = await createVerificationHashArgon2id(relayChannel, 'safevault-relay-salt');
      const cryptoKey = await deriveKeyArgon2id(relayPIN, salt.slice(0, 16));
      
      const decryptedJson = await decrypt(payload.ciphertext, payload.iv, cryptoKey);
      const incomingPayload = JSON.parse(decryptedJson);
      
      // FIX 1: Support both legacy plain array and new SyncPayload format
      const incomingCredentials = Array.isArray(incomingPayload) ? incomingPayload : (incomingPayload.credentials ?? []);
      const incomingDeletedIds: string[] = Array.isArray(incomingPayload) ? [] : (incomingPayload.deletedIds ?? []);

      if (Array.isArray(incomingCredentials)) {
        const merged = await mergeCredentials(incomingCredentials, incomingDeletedIds);
        setRelayStatus({ type: 'success', message: `Synced! Merged ${merged.length} records from relay channel.` });
      } else {
        throw new Error('Invalid decrypted data format');
      }
    } catch (err: any) {
      setRelayStatus({ type: 'error', message: err.message || 'Decryption/Pull failed. Verify PIN and Channel ID.' });
    } finally {
      setRelayLoading(false);
    }
  };

  // ── FIX 2: Auto-Discover using actual Electron network interfaces ──────────
  const [discovering, setDiscovering] = useState(false);

  const handleAutoDiscover = async () => {
    setDiscovering(true);
    setClientStatus({ type: 'success', message: 'Scanning local network for SafeVault Sync Server...' });
    
    // FIX 2: Fetch real subnets from Electron, fallback to common ones
    let subnets: string[] = ['192.168.1', '192.168.0', '192.168.2', '10.0.0'];
    if (isElectronApp && (window as any).safevault?.getLocalSubnets) {
      try {
        const electronSubnets: string[] = await (window as any).safevault.getLocalSubnets();
        if (electronSubnets.length > 0) {
          // Prioritize actual interfaces, append fallbacks that aren't duplicates
          subnets = [...new Set([...electronSubnets, ...subnets])];
        }
      } catch { /* fallback to hardcoded list */ }
    }

    // Also prepend subnet from currently typed IP if present
    if (targetIP) {
      const match = targetIP.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (match && !subnets.includes(match[1])) subnets.unshift(match[1]);
    }

    let foundIP: string | null = null;
    
    for (const subnet of subnets) {
      if (foundIP) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const promises = Array.from({ length: 254 }, (_, i) => {
          const ip = `${subnet}.${i + 1}`;
          return fetch(`http://${ip}:58241/`, { method: 'GET', signal: controller.signal })
            .then(async (res) => {
              if (res.status === 404) {
                const data = await res.json().catch(() => ({}));
                if (data.error === 'Not Found') return ip;
              }
              return null;
            })
            .catch(() => null);
        });
        
        const results = await Promise.all(promises);
        clearTimeout(timeoutId);
        foundIP = results.find(ip => ip !== null) ?? null;
      } catch { /* ignore subnet errors */ }
    }
    
    if (foundIP) {
      setTargetIP(`${foundIP}:58241`);
      setClientStatus({ type: 'success', message: `Found SafeVault at ${foundIP}:58241! Enter PIN and press Sync.` });
    } else {
      setClientStatus({
        type: 'error',
        message: 'Could not find sync server. Check Wi-Fi, start sync server on Desktop, or scan the QR Code.'
      });
    }
    setDiscovering(false);
  };

  // ── Wi-Fi Client Sync ────────────────────────────────────────────────────
  const deriveWifiPINKey = async (pin: string, saltHex: string): Promise<CryptoKey> => deriveKeyArgon2id(pin, saltHex);

  const handleClientSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetIP || !pairingPIN) {
      setClientStatus({ type: 'error', message: 'Please fill in both target IP and 6-digit PIN' });
      return;
    }
    setClientLoading(true);
    setClientStatus(null);

    let url = targetIP.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
    if (!url.replace(/https?:\/\//, '').includes(':')) url = url + ':58241';
    if (!url.endsWith('/sync')) url = url + '/sync';

    try {
      const salt = await createVerificationHashArgon2id(pairingPIN.trim(), 'safevault-wifi-salt');
      const aesKey = await deriveWifiPINKey(pairingPIN.trim(), salt.slice(0, 16));
      
      // FIX 1: Send SyncPayload (credentials + deletedIds) so server gets tombstones
      const syncPayload = getSyncPayloadRef.current();
      const vaultJson = JSON.stringify(syncPayload);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(vaultJson);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, dataBuffer);
      const buffer = new Uint8Array(encrypted);
      const ivBase64 = uint8ArrayToBase64(iv);
      const tagOffset = buffer.length - 16;
      const ciphertextBytes = buffer.slice(0, tagOffset);
      const tagBytes = buffer.slice(tagOffset);

      const timestamp = Date.now().toString();
      const pinMsgBuffer = encoder.encode(pairingPIN.trim() + timestamp);
      const pinHashBuffer = await window.crypto.subtle.digest('SHA-256', pinMsgBuffer);
      const pinHashHex = Array.from(new Uint8Array(pinHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Hash': pinHashHex, 'X-Sync-Timestamp': timestamp },
        body: JSON.stringify({ ciphertext: uint8ArrayToBase64(ciphertextBytes), iv: ivBase64, tag: uint8ArrayToBase64(tagBytes) })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success && resData.encrypted) {
        const resCiphertext = base64ToUint8Array(resData.encrypted.ciphertext);
        const resIv = base64ToUint8Array(resData.encrypted.iv);
        const resTag = base64ToUint8Array(resData.encrypted.tag);
        const combined = new Uint8Array(resCiphertext.length + resTag.length);
        combined.set(resCiphertext);
        combined.set(resTag, resCiphertext.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: resIv as any },
          aesKey,
          combined.buffer as ArrayBuffer
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        const serverResponse = JSON.parse(decryptedJson);

        // FIX 1: Support SyncPayload response format
        const mergedVault = Array.isArray(serverResponse) ? serverResponse : (serverResponse.credentials ?? []);
        const serverDeletedIds: string[] = Array.isArray(serverResponse) ? [] : (serverResponse.deletedIds ?? []);

        if (Array.isArray(mergedVault)) {
          await mergeCredentials(mergedVault, serverDeletedIds);
          setClientStatus({ type: 'success', message: `Sync successful! Merged ${mergedVault.length} records.` });
        } else {
          throw new Error('Invalid vault response from server');
        }
      } else {
        throw new Error('Invalid vault response from server');
      }
    } catch (err: any) {
      setClientStatus({ type: 'error', message: err.message || 'Connection failed. Verify Wi-Fi network and pairing PIN.' });
    } finally {
      setClientLoading(false);
    }
  };

  const getQRValue = () => {
    if (!serverInfo) return '';
    return JSON.stringify({ ip: serverInfo.ips[0] || '127.0.0.1', port: serverInfo.port, pin: serverInfo.pin });
  };

  const getRelayQRValue = () => {
    if (!relayChannel || !relayPIN) return '';
    return JSON.stringify({ channel: relayChannel, relayPin: relayPIN });
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
        {/* FIX 5: Last Sync Timestamp */}
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Clock className="w-3 h-3 text-emerald-500/60" />
            <span>Last synced: <span className="text-emerald-400">{formatRelativeTime(lastSyncedAt)}</span></span>
          </div>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
        {isElectronApp && (
          <button
            type="button"
            onClick={() => setSyncMode('wifi')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              syncMode === 'wifi' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Local Wi-Fi (P2P)
          </button>
        )}
        <button
          type="button"
          onClick={() => setSyncMode('relay')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            syncMode === 'relay' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Cloud Relay (E2EE)
        </button>
      </div>

      {syncMode === 'wifi' ? (
        /* Local Wi-Fi Sync */
        isElectronApp ? (
          /* Host/Server View (Electron Desktop) */
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
                        <code key={ip} className="block text-sm text-emerald-400 font-mono">{ip}:{serverInfo.port}</code>
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
                      Scan on mobile to auto-fill IP + PIN
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300 leading-normal">
                      <strong>Windows Firewall Blocking?</strong>
                      <p className="text-gray-400 mt-1">Run in PowerShell as Admin to allow the sync port:</p>
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
          /* Client View (Browser / Mobile) */
          <div className="space-y-4">
            {showScanner ? (
              <div className="p-4 bg-black/60 border border-white/10 rounded-2xl relative space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Scan Host QR Code
                  </span>
                  <button type="button" onClick={() => setShowScanner(false)} className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl bg-[#080808] border border-white/5 aspect-square relative">
                  <div id="qr-reader-container" className="w-full h-full"></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setClientStatus(null); setShowScanner(true); }}
                  className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4" /> Scan QR Code
                </button>
                <button type="button" disabled={discovering} onClick={handleAutoDiscover}
                  className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:bg-gray-800 disabled:text-gray-600 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  {discovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  {discovering ? 'Searching...' : 'Auto-Discover'}
                </button>
              </div>
            )}

            <form onSubmit={handleClientSync} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Target IP Address</label>
                <input type="text" placeholder="e.g., 192.168.1.100" value={targetIP}
                  onChange={e => setTargetIP(e.target.value)} disabled={clientLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">6-Digit Pairing PIN</label>
                <input type="text" maxLength={6} placeholder="e.g., 382914" value={pairingPIN}
                  onChange={e => setPairingPIN(e.target.value.replace(/\D/g, ''))} disabled={clientLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold" />
              </div>
              <button type="submit" disabled={clientLoading}
                className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {clientLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Synchronizing...</> : 'Initiate Sync'}
              </button>
              {clientStatus && (
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${clientStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  {clientStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
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
              Strict Offline Mode (Air-Gap) is active. Disable it in Settings to use cloud relay sync.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1.5">
              <span className="text-xs text-emerald-400 font-bold block">🔒 Zero-Knowledge Cloud Relay</span>
              <p className="text-[11px] text-gray-400 leading-normal">
                Sync across different networks (mobile ↔ web ↔ extension) without running a local PC server.
                Data is AES-GCM encrypted before leaving your device — the relay server sees only ciphertext.
              </p>
            </div>

            <form className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400">Sync Channel ID</label>
                  {/* FIX 4: Generate random channel button */}
                  <button type="button" onClick={handleGenerateChannel}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Shuffle className="w-3 h-3" /> Generate
                  </button>
                </div>
                <input type="text" placeholder="e.g., vault-a3f7-k9x2" value={relayChannel}
                  onChange={e => setRelayChannel(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">6-Digit E2EE Encryption PIN</label>
                <input type="text" maxLength={6} placeholder="e.g., 839210" value={relayPIN}
                  onChange={e => setRelayPIN(e.target.value.replace(/\D/g, ''))} disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold" />
              </div>

              {/* FIX 4: Show Relay QR Code if both fields are filled */}
              {relayChannel && relayPIN.length === 6 && (
                <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className="p-2 bg-white rounded-lg">
                    <QRCodeSVG value={getRelayQRValue()} size={80} bgColor="#ffffff" fgColor="#000000" includeMargin={false} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[11px] text-gray-400 leading-normal">Scan this QR Code on the other device to auto-fill Channel ID + PIN.</p>
                    <button type="button" onClick={copyRelayQR}
                      className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                      <Copy className="w-3 h-3" /> Copy QR Data
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={relayLoading} onClick={() => handleRelayPush()}
                  className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {relayLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Push Encrypted
                </button>
                <button type="button" disabled={relayLoading} onClick={() => handleRelayPull()}
                  className="py-3 bg-emerald-500 text-slate-900 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {relayLoading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-900" /> : null}
                  Pull & Merge
                </button>
              </div>

              {relayStatus && (
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${relayStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  {relayStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
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
