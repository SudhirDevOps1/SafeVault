import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle, Key, QrCode, Camera, X, Clock, Copy, Shuffle, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useVaultStore } from '../stores/vaultStore';
import { encrypt, decrypt, deriveKey, createVerificationHash } from '../utils/crypto';

// Safe base64 conversion helpers (no callstack size overflows)
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  let normalized = base64.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }
  const binaryString = window.atob(normalized);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

function generateChannelId(): string {
  const rand = () => Math.random().toString(36).slice(2, 6);
  return `vault-${rand()}-${rand()}`;
}

export default function LocalSync() {
  const { 
    credentials,
    strictOfflineMode, 
    lastSyncedAt, 
    getSyncPayloadDoubleLayer,
    mergeCredentialsDoubleLayer,
    encryptionKey
  } = useVaultStore();

  const isElectronApp = typeof window !== 'undefined' && 'safevault' in window;
  const [syncMode, setSyncMode] = useState<'wifi' | 'relay'>('wifi');
  const [wifiRole, setWifiRole] = useState<'send' | 'receive'>(isElectronApp ? 'receive' : 'send');

  // Live Auto-Sync Option Toggle
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => localStorage.getItem('safevault_auto_sync') === 'true');

  // Server state (Wi-Fi Receive)
  const [isServerActive, setIsServerActive] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ ips: string[]; port: number; pin: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Client state (Wi-Fi Send)
  const [targetIP, setTargetIP] = useState('');
  const [pairingPIN, setPairingPIN] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientStatus, setClientStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Camera scanner
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Cloud Relay configs
  const [relayChannel, setRelayChannel] = useState(() => localStorage.getItem('safevault_relay_channel') || '');
  const [relayPIN, setRelayPIN] = useState(() => localStorage.getItem('safevault_relay_pin') || '');
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // References for live closures
  const credentialsRef = useRef(credentials);
  useEffect(() => { credentialsRef.current = credentials; }, [credentials]);
  const encryptionKeyRef = useRef(encryptionKey);
  useEffect(() => { encryptionKeyRef.current = encryptionKey; }, [encryptionKey]);

  // Persist Auto-Sync settings
  useEffect(() => {
    localStorage.setItem('safevault_auto_sync', autoSyncEnabled ? 'true' : 'false');
  }, [autoSyncEnabled]);

  // Live Auto-Sync push trigger when credentials list updates (Cloud Relay only)
  useEffect(() => {
    if (!autoSyncEnabled || syncMode !== 'relay' || !relayChannel || !relayPIN || !encryptionKey) return;
    const timer = setTimeout(() => {
      handleRelayPush(true);
    }, 1500); // 1.5 seconds debounce
    return () => clearTimeout(timer);
  }, [credentials, autoSyncEnabled, syncMode]);

  // IPC setup for Host Sync requests (Wi-Fi Receive Mode)
  useEffect(() => {
    if (!isElectronApp || !isServerActive || !serverInfo) return;

    const unsubscribe = (window as any).safevault.onSyncRequest(async (encryptedPayload: any, respond: (err: any, resPayload: any) => void) => {
      setSyncStatus('Pairing requested...');
      
      try {
        // Derive transition key (LAYER 2)
        const salt = await createVerificationHash(serverInfo.pin, 'safevault-wifi-salt');
        const saltBase64 = window.btoa(salt).slice(0, 16);
        const sessionKey = await deriveKey(serverInfo.pin, saltBase64);

        // Decrypt LAYER 2
        const resCiphertext = base64ToUint8Array(encryptedPayload.ciphertext);
        const resIv = base64ToUint8Array(encryptedPayload.iv);
        const resTag = base64ToUint8Array(encryptedPayload.tag);
        
        const combined = new Uint8Array(resCiphertext.length + resTag.length);
        combined.set(resCiphertext);
        combined.set(resTag, resCiphertext.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: resIv as any },
          sessionKey,
          combined.buffer as ArrayBuffer
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        const incomingLayer1 = JSON.parse(decryptedJson);

        // LAYER 1: Decrypt and merge using local Vault Master Key
        await mergeCredentialsDoubleLayer(incomingLayer1);

        // Build Layer 1 Response Package
        const responseLayer1 = await getSyncPayloadDoubleLayer();
        const responseLayer1Json = JSON.stringify(responseLayer1.encryptedLayer1);

        // Encrypt Layer 2 (Transition Session Key)
        const encoder = new TextEncoder();
        const responseBuffer = encoder.encode(responseLayer1Json);
        const respIv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedResponseBuffer = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: respIv },
          sessionKey,
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
        const userFriendlyMsg = 'Sync failed: Both devices must have the SAME Master Password to sync.';
        setSyncStatus(userFriendlyMsg);
        setTimeout(() => setSyncStatus(null), 8000);
      }
    });

    return () => { unsubscribe(); };
  }, [isElectronApp, isServerActive, serverInfo]);

  // Clean up server on unmount
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

  // Scanner scanner startup
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
                setClientStatus({ type: 'success', message: 'Wi-Fi QR scanned! Ready to sync.' });
                html5QrCode.stop().then(() => { setShowScanner(false); scannerRef.current = null; }).catch(() => {});
              }
              if (data.channel && data.relayPin) {
                setSyncMode('relay');
                setRelayChannel(data.channel);
                setRelayPIN(data.relayPin);
                localStorage.setItem('safevault_relay_channel', data.channel);
                localStorage.setItem('safevault_relay_pin', data.relayPin);
                setRelayStatus({ type: 'success', message: 'Cloud Relay QR scanned! Click Pull.' });
                html5QrCode.stop().then(() => { setShowScanner(false); scannerRef.current = null; }).catch(() => {});
              }
            } catch {
              setClientStatus({ type: 'error', message: 'Invalid QR payload' });
            }
          },
          () => {}
        );
      } catch {
        setClientStatus({ type: 'error', message: 'Camera permission denied' });
        setShowScanner(false);
      }
    };

    startScanner();
    return () => { if (scannerRef.current && scannerRef.current.isScanning) { scannerRef.current.stop().catch(() => {}); } };
  }, [showScanner]);

  const handleStartServer = async () => {
    try {
      setSyncStatus(null);
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

  const handleGenerateChannel = useCallback(() => {
    const channel = generateChannelId();
    setRelayChannel(channel);
    localStorage.setItem('safevault_relay_channel', channel);
  }, []);

  const copyRelayQR = useCallback(() => {
    if (!relayChannel || !relayPIN) return;
    const data = JSON.stringify({ channel: relayChannel, relayPin: relayPIN });
    navigator.clipboard.writeText(data).catch(() => {});
  }, [relayChannel, relayPIN]);

  // Cloud Relay Push E2EE Double Layer
  const handleRelayPush = async (isBackground = false) => {
    if (!relayChannel || !relayPIN) {
      if (!isBackground) setRelayStatus({ type: 'error', message: 'Please enter a Channel ID and PIN' });
      return;
    }
    if (!isBackground) setRelayLoading(true);
    try {
      const salt = await createVerificationHash(relayChannel, 'safevault-relay-salt');
      const sessionKey = await deriveKey(relayPIN, salt.slice(0, 16));
      
      // LAYER 1: Encrypt list locally using the Vault Master key
      const doubleLayerPayload = await getSyncPayloadDoubleLayer();
      
      // LAYER 2: Encrypt Layer 1 transit wrapper payload using the Session PIN key
      const layer1String = JSON.stringify(doubleLayerPayload.encryptedLayer1);
      const { ciphertext, iv } = await encrypt(layer1String, sessionKey);
      
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Source': 'SafeVault' },
        body: JSON.stringify({ ciphertext, iv })
      });
      
      if (!response.ok) throw new Error('Cloud push failed');
      if (!isBackground) {
        setRelayStatus({ type: 'success', message: 'Vault E2EE double-layered pushed successfully!' });
      }
    } catch (err: any) {
      if (!isBackground) {
        setRelayStatus({ type: 'error', message: err.message || 'Push connection error.' });
      }
    } finally {
      if (!isBackground) setRelayLoading(false);
    }
  };

  // Cloud Relay Pull E2EE Double Layer
  const handleRelayPull = async () => {
    if (!relayChannel || !relayPIN) {
      setRelayStatus({ type: 'error', message: 'Please enter a Channel ID and PIN' });
      return;
    }
    setRelayLoading(true);
    setRelayStatus(null);
    try {
      const response = await fetch(`https://safevault-sync-relay.cloudflare.workers.dev/channel/${relayChannel}`, {
        headers: { 'X-Request-Source': 'SafeVault' }
      });
      if (!response.ok) throw new Error('No relay data active. Check sender status.');
      
      const payload = await response.json();
      const salt = await createVerificationHash(relayChannel, 'safevault-relay-salt');
      const sessionKey = await deriveKey(relayPIN, salt.slice(0, 16));
      
      // Decrypt Layer 2 (Session Key)
      const decryptedLayer1Json = await decrypt(payload.ciphertext, payload.iv, sessionKey);
      const encryptedLayer1 = JSON.parse(decryptedLayer1Json);
      
      // Decrypt Layer 1 & Merge (Master Key)
      const merged = await mergeCredentialsDoubleLayer(encryptedLayer1);
      setRelayStatus({ type: 'success', message: `Vault decrypted and merged ${merged.length} items.` });
    } catch (err: any) {
      setRelayStatus({ type: 'error', message: err.message || 'Verification key mismatch.' });
    } finally {
      setRelayLoading(false);
    }
  };

  // Local Network Subnet scanner Auto-Discover
  const [discovering, setDiscovering] = useState(false);
  const handleAutoDiscover = async () => {
    setDiscovering(true);
    setClientStatus({ type: 'success', message: 'Scanning subnet segments...' });
    
    let subnets: string[] = ['192.168.1', '192.168.0', '192.168.2', '10.0.0'];
    if (isElectronApp && (window as any).safevault?.getLocalSubnets) {
      try {
        const electronSubnets: string[] = await (window as any).safevault.getLocalSubnets();
        if (electronSubnets.length > 0) {
          subnets = [...new Set([...electronSubnets, ...subnets])];
        }
      } catch { /* ignore interface error */ }
    }

    let foundIP: string | null = null;
    
    for (const subnet of subnets) {
      if (foundIP) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 900);
        
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
      } catch {}
    }
    
    if (foundIP) {
      setTargetIP(`${foundIP}:58241`);
      setClientStatus({ type: 'success', message: `Found local peer at ${foundIP}! Enter PIN and sync.` });
    } else {
      setClientStatus({ type: 'error', message: 'Could not auto-discover peer server.' });
    }
    setDiscovering(false);
  };


  // Client Wi-Fi P2P Double-Layer E2EE Sync
  const handleClientSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetIP || !pairingPIN) {
      setClientStatus({ type: 'error', message: 'Fill in target IP and PIN' });
      return;
    }
    setClientLoading(true);
    setClientStatus(null);

    let url = targetIP.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
    if (!url.replace(/https?:\/\//, '').includes(':')) url = url + ':58241';
    if (!url.endsWith('/sync')) url = url + '/sync';

    try {
      // Session PIN Key (LAYER 2)
      const salt = await createVerificationHash(pairingPIN.trim(), 'safevault-wifi-salt');
      const saltBase64 = window.btoa(salt).slice(0, 16);
      const sessionKey = await deriveKey(pairingPIN.trim(), saltBase64);
      
      // LAYER 1: Encrypt locally using local Master Vault Key
      const doubleLayerPayload = await getSyncPayloadDoubleLayer();
      
      // LAYER 2: Encrypt Layer 1 transit wrapper payload using Session PIN Key
      const layer1String = JSON.stringify(doubleLayerPayload.encryptedLayer1);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(layer1String);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, dataBuffer);
      const buffer = new Uint8Array(encrypted);
      const ivBase64 = uint8ArrayToBase64(iv);
      const tagOffset = buffer.length - 16;
      const ciphertextBytes = buffer.slice(0, tagOffset);
      const tagBytes = buffer.slice(tagOffset);

      // Signature signature challenge transit
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
        throw new Error(errData.error || `Sync server error`);
      }

      const resData = await response.json();
      if (resData.success && resData.encrypted) {
        // Decrypt Layer 2 (Session key response)
        const resCiphertext = base64ToUint8Array(resData.encrypted.ciphertext);
        const resIv = base64ToUint8Array(resData.encrypted.iv);
        const resTag = base64ToUint8Array(resData.encrypted.tag);
        const combined = new Uint8Array(resCiphertext.length + resTag.length);
        combined.set(resCiphertext);
        combined.set(resTag, resCiphertext.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: resIv as any },
          sessionKey,
          combined.buffer as ArrayBuffer
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBuffer);
        const encryptedLayer1Response = JSON.parse(decryptedJson);

        // Decrypt Layer 1 & Merge (Master key response)
        const merged = await mergeCredentialsDoubleLayer(encryptedLayer1Response);
        setClientStatus({ type: 'success', message: `Sync complete! Merged ${merged.length} items.` });
      } else {
        throw new Error('Invalid server package response');
      }
    } catch (err: any) {
      const isKeyError = err.message && (err.message.includes('key') || err.message.includes('decrypt') || err.message.includes('compatibility') || err.message.includes('Verification'));
      const friendlyMsg = isKeyError 
        ? 'Sync failed: Both devices must have the SAME Master Password to sync.' 
        : (err.message || 'Key verification mismatch.');
      setClientStatus({ type: 'error', message: friendlyMsg });
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

  return (
    <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
              Sync Center <span title="Double-Layer E2EE Protection Active"><Shield className="w-4.5 h-4.5 text-emerald-400" /></span>
            </h3>
            <p className="text-xs text-gray-400">Safe, zero-knowledge pairing across all devices.</p>
          </div>
        </div>
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Clock className="w-3 h-3 text-emerald-500/60" />
            <span>Synced: <span className="text-emerald-400">{formatRelativeTime(lastSyncedAt)}</span></span>
          </div>
        )}
      </div>

      {/* Sync Mode selector tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
        <button
          type="button"
          onClick={() => setSyncMode('wifi')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            syncMode === 'wifi' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Local Wi-Fi (P2P)
        </button>
        <button
          type="button"
          onClick={() => setSyncMode('relay')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            syncMode === 'relay' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Cloud Relay (E2EE)
        </button>
      </div>

      {/* Zero-Knowledge Master Password Matching Requirement Notice */}
      <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 leading-normal">
          <strong className="text-emerald-400 font-semibold">Security Requirement:</strong> Both devices must be unlocked using the <strong>SAME master password</strong> to decrypt and merge sync data, since all credentials are encrypted zero-knowledge.
        </p>
      </div>

      {syncMode === 'wifi' ? (
        /* Local P2P Wi-Fi view */
        <div className="space-y-4">
          {!isElectronApp && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 block">💡 Mobile Sync Tip</span>
              <p className="text-[10px] text-gray-300 leading-normal">
                To sync locally, start the <strong>Host Server</strong> on your desktop SafeVault app, 
                then click <strong>Scan QR Code</strong> or use <strong>Auto-Discover</strong> below to pair this device.
              </p>
            </div>
          )}
          <div className="flex gap-2 p-1 bg-white/5 rounded-lg max-w-[200px]">
            {isElectronApp && (
              <button
                type="button"
                onClick={() => setWifiRole('receive')}
                className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                  wifiRole === 'receive' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                Host Server
              </button>
            )}
            <button
              type="button"
              onClick={() => setWifiRole('send')}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                wifiRole === 'send' || !isElectronApp ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sync Client
            </button>
          </div>

          {wifiRole === 'receive' && isElectronApp ? (
            /* Server Host role view */
            <div className="space-y-6 animate-fade-in">
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
              
              {syncStatus && (
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-emerald-400 font-medium font-mono">
                  ⚡ Status: {syncStatus}
                </div>
              )}

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
                        Scan on client to pair
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Client Send role view (Universal on all devices) */
            <div className="space-y-4 animate-fade-in">
              {showScanner ? (
                <div className="p-4 bg-black/60 border border-white/10 rounded-2xl relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      Scan Host QR Code
                    </span>
                    <button type="button" onClick={() => setShowScanner(false)} className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400">
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
                  <input type="text" placeholder="e.g. 192.168.1.100" value={targetIP}
                    onChange={e => setTargetIP(e.target.value)} disabled={clientLoading}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">6-Digit Pairing PIN</label>
                  <input type="text" maxLength={6} placeholder="e.g. 382914" value={pairingPIN}
                    onChange={e => setPairingPIN(e.target.value.replace(/\D/g, ''))} disabled={clientLoading}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold" />
                </div>
                <button type="submit" disabled={clientLoading}
                  className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
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
          )}
        </div>
      ) : (
        /* Cloud Relay (E2EE) view */
        strictOfflineMode ? (
          <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-3 text-center py-8">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <span className="text-sm font-bold text-rose-400 block">Cloud Sync Blocked</span>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-normal">
              Strict Offline Mode is active. Disable it in Settings to use Cloud Relay.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
              <div className="space-y-1 pr-2">
                <span className="text-xs text-emerald-400 font-bold block">Live Hot-Sync</span>
                <p className="text-[10px] text-gray-400 leading-normal">Auto push encrypted database updates in real-time when edited.</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoSyncEnabled ? 'bg-emerald-500' : 'bg-white/10'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-900 shadow ring-0 transition duration-200 ease-in-out ${
                  autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <form className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400">Sync Channel ID</label>
                  <button type="button" onClick={handleGenerateChannel}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300">
                    <Shuffle className="w-3 h-3" /> Generate
                  </button>
                </div>
                <input type="text" placeholder="e.g. vault-a3f7-k9x2" value={relayChannel}
                  onChange={e => { setRelayChannel(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); localStorage.setItem('safevault_relay_channel', e.target.value); }} disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">6-Digit E2EE Encryption PIN</label>
                <input type="text" maxLength={6} placeholder="e.g. 839210" value={relayPIN}
                  onChange={e => { setRelayPIN(e.target.value.replace(/\D/g, '')); localStorage.setItem('safevault_relay_pin', e.target.value); }} disabled={relayLoading}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono tracking-widest text-center text-lg font-bold" />
              </div>

              {relayChannel && relayPIN.length === 6 && (
                <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-xl animate-fade-in">
                  <div className="p-2 bg-white rounded-lg">
                    <QRCodeSVG value={getRelayQRValue()} size={80} bgColor="#ffffff" fgColor="#000000" includeMargin={false} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[11px] text-gray-400 leading-normal">Scan QR Code on other device to auto-fill Channel & PIN.</p>
                    <button type="button" onClick={copyRelayQR}
                      className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300">
                      <Copy className="w-3 h-3" /> Copy QR Data
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={relayLoading} onClick={() => handleRelayPush(false)}
                  className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  {relayLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Push Encrypted
                </button>
                <button type="button" disabled={relayLoading} onClick={handleRelayPull}
                  className="py-3 bg-emerald-500 text-slate-900 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2">
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
