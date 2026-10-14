/**
 * SafeVault TOTP (Time-based One-Time Password) Implementation
 * 
 * Implements RFC 6238 TOTP using Web Crypto API.
 * Supports SHA-1, SHA-256, SHA-512, Steam Guard, and URI parsing.
 */

export type TOTPAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TOTPOptions {
  algorithm?: TOTPAlgorithm;
  digits?: number;
  period?: number;
  isSteam?: boolean;
}

export interface ParsedOtpAuth {
  type: 'totp' | 'hotp';
  secret: string;
  label: string;
  issuer?: string;
  algorithm: TOTPAlgorithm;
  digits: number;
  period: number;
}

const STEAM_CHARS = '23456789BCDFGHJKMNPQRTVWXY';

/** Decode Base32 string to Uint8Array */
export function base32Decode(base32: string): Uint8Array<ArrayBuffer> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.replace(/[\s=-]/g, '').toUpperCase();
  
  let bits = '';
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/** Convert a number to a big-endian 8-byte ArrayBuffer */
function intToBytes(num: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(num / 0x100000000));
  view.setUint32(4, num & 0xffffffff);
  return buffer;
}

function getSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return crypto.subtle;
}

/** Generate HMAC with configurable hash */
async function hmac(key: Uint8Array<ArrayBuffer>, data: ArrayBuffer, algorithm: TOTPAlgorithm = 'SHA-1'): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  const cryptoKey = await subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  return subtle.sign('HMAC', cryptoKey, data);
}

/** Dynamic truncation as per RFC 4226 */
function dynamicTruncation(hmacResult: ArrayBuffer, digits = 6): number {
  const bytes = new Uint8Array(hmacResult);
  const offset = bytes[bytes.length - 1] & 0x0f;
  const code =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  return code % Math.pow(10, digits);
}

/** Truncate for Steam Guard alphanumeric codes */
function steamTruncation(hmacResult: ArrayBuffer): string {
  const bytes = new Uint8Array(hmacResult);
  const offset = bytes[bytes.length - 1] & 0x0f;
  let fullCode =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  
  let steamCode = '';
  for (let i = 0; i < 5; i++) {
    steamCode += STEAM_CHARS[fullCode % STEAM_CHARS.length];
    fullCode = Math.floor(fullCode / STEAM_CHARS.length);
  }
  return steamCode;
}

/** Generate a TOTP code from a Base32 secret with options */
export async function generateTOTP(secret: string, options: TOTPOptions = {}): Promise<string> {
  if (!secret || secret.trim().length === 0) return '';
  
  const algorithm = options.algorithm || 'SHA-1';
  const digits = options.digits || 6;
  const period = options.period || 30;
  const isSteam = options.isSteam || false;

  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / period);
    const counterBytes = intToBytes(counter);
    const hmacResult = await hmac(key, counterBytes, algorithm);

    if (isSteam) {
      return steamTruncation(hmacResult);
    }

    const code = dynamicTruncation(hmacResult, digits);
    return code.toString().padStart(digits, '0');
  } catch {
    return 'ERROR';
  }
}

/** Get seconds remaining in current TOTP period */
export function getTOTPTimeRemaining(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

/** Get the standard TOTP period */
export function getTOTPPeriod(): number {
  return 30;
}

/** Validate a Base32 TOTP secret */
export function isValidTOTPSecret(secret: string): boolean {
  if (!secret || secret.trim().length === 0) return false;
  const cleaned = secret.replace(/[\s=-]/g, '').toUpperCase();
  return /^[A-Z2-7]+$/.test(cleaned) && cleaned.length >= 16;
}

/** Parse an otpauth:// URL into structured parameters */
export function parseOtpAuthUri(uri: string): ParsedOtpAuth | null {
  if (!uri || !uri.startsWith('otpauth://')) return null;

  try {
    const url = new URL(uri);
    const type = url.host.toLowerCase() as 'totp' | 'hotp';
    if (type !== 'totp' && type !== 'hotp') return null;

    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const secret = url.searchParams.get('secret') || '';
    if (!secret) return null;

    const issuer = url.searchParams.get('issuer') || undefined;
    const rawAlgorithm = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
    let algorithm: TOTPAlgorithm = 'SHA-1';
    if (rawAlgorithm === 'SHA256') algorithm = 'SHA-256';
    if (rawAlgorithm === 'SHA512') algorithm = 'SHA-512';

    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    const period = parseInt(url.searchParams.get('period') || '30', 10);

    return {
      type,
      secret,
      label,
      issuer,
      algorithm,
      digits: digits === 8 ? 8 : 6,
      period: period > 0 ? period : 30
    };
  } catch {
    return null;
  }
}
