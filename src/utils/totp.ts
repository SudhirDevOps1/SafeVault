/**
 * SafeVault TOTP (Time-based One-Time Password) Implementation
 * 
 * Implements RFC 6238 TOTP using Web Crypto API.
 * Supports SHA-1, SHA-256, SHA-512, Steam Guard, URI parsing,
 * next-code preview, and Google Authenticator migration payload decoding.
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

export interface GoogleAuthAccount {
  secret: string; // Base32 encoded string
  name: string;
  issuer?: string;
  algorithm: TOTPAlgorithm;
  digits: 6 | 8;
  type: 'totp' | 'hotp';
}

const STEAM_CHARS = '23456789BCDFGHJKMNPQRTVWXY';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encode Uint8Array to Base32 string */
export function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** Decode Base32 string to Uint8Array */
export function base32Decode(base32: string): Uint8Array<ArrayBuffer> {
  const cleaned = base32.replace(/[\s=-]/g, '').toUpperCase();
  
  let bits = '';
  for (const char of cleaned) {
    const val = BASE32_ALPHABET.indexOf(char);
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

/** Generate a TOTP code at a specific timestamp */
export async function generateTOTPAtTime(secret: string, timestamp: number, options: TOTPOptions = {}): Promise<string> {
  if (!secret || secret.trim().length === 0) return '';
  
  const algorithm = options.algorithm || 'SHA-1';
  const digits = options.digits || 6;
  const period = options.period || 30;
  const isSteam = options.isSteam || false;

  try {
    const key = base32Decode(secret);
    const counter = Math.floor(timestamp / 1000 / period);
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

/** Generate current TOTP code from a Base32 secret with options */
export async function generateTOTP(secret: string, options: TOTPOptions = {}): Promise<string> {
  return generateTOTPAtTime(secret, Date.now(), options);
}

/** Generate the upcoming next TOTP code (preview when current is about to expire) */
export async function generateNextTOTP(secret: string, options: TOTPOptions = {}): Promise<string> {
  const period = options.period || 30;
  return generateTOTPAtTime(secret, Date.now() + period * 1000, options);
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

/** Lightweight protobuf reader for Google Authenticator migration payload */
function decodeVarint(bytes: Uint8Array, offset: number): { value: number; newOffset: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < bytes.length) {
    const b = bytes[pos++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, newOffset: pos };
}

/** Parse Google Authenticator Migration URI (otpauth-migration://offline?data=...) */
export function parseGoogleAuthMigration(uriOrData: string): GoogleAuthAccount[] {
  let base64Data = uriOrData.trim();
  if (base64Data.startsWith('otpauth-migration://')) {
    try {
      const url = new URL(base64Data);
      base64Data = url.searchParams.get('data') || '';
    } catch {
      return [];
    }
  }

  if (!base64Data) return [];

  // Decode Base64 to Uint8Array
  let rawBytes: Uint8Array;
  try {
    const decodedStr = atob(decodeURIComponent(base64Data));
    rawBytes = new Uint8Array(decodedStr.length);
    for (let i = 0; i < decodedStr.length; i++) {
      rawBytes[i] = decodedStr.charCodeAt(i);
    }
  } catch {
    return [];
  }

  const accounts: GoogleAuthAccount[] = [];
  let pos = 0;

  try {
    while (pos < rawBytes.length) {
      const { value: tagAndType, newOffset } = decodeVarint(rawBytes, pos);
      pos = newOffset;
      const fieldNumber = tagAndType >>> 3;
      const wireType = tagAndType & 0x07;

      if (fieldNumber === 1 && wireType === 2) {
        // OtpParameters message (length-delimited)
        const { value: len, newOffset: posAfterLen } = decodeVarint(rawBytes, pos);
        pos = posAfterLen;
        const paramEnd = pos + len;

        let secretBytes: Uint8Array | null = null;
        let name = '';
        let issuer = '';
        let algorithmCode = 1;
        let digitsCode = 1;
        let typeCode = 2; // default TOTP

        let subPos = pos;
        while (subPos < paramEnd) {
          const { value: subTag, newOffset: subAfterTag } = decodeVarint(rawBytes, subPos);
          subPos = subAfterTag;
          const subField = subTag >>> 3;
          const subWire = subTag & 0x07;

          if (subWire === 2) {
            const { value: subLen, newOffset: afterSubLen } = decodeVarint(rawBytes, subPos);
            subPos = afterSubLen;
            const slice = rawBytes.subarray(subPos, subPos + subLen);
            subPos += subLen;

            if (subField === 1) secretBytes = slice;
            if (subField === 2) name = new TextDecoder().decode(slice);
            if (subField === 3) issuer = new TextDecoder().decode(slice);
          } else if (subWire === 0) {
            const { value: varVal, newOffset: afterVar } = decodeVarint(rawBytes, subPos);
            subPos = afterVar;
            if (subField === 4) algorithmCode = varVal;
            if (subField === 5) digitsCode = varVal;
            if (subField === 6) typeCode = varVal;
          } else {
            subPos++;
          }
        }

        pos = paramEnd;

        if (secretBytes && secretBytes.length > 0) {
          const secretBase32 = base32Encode(secretBytes);
          let algorithm: TOTPAlgorithm = 'SHA-1';
          if (algorithmCode === 2) algorithm = 'SHA-256';
          if (algorithmCode === 3) algorithm = 'SHA-512';

          accounts.push({
            secret: secretBase32,
            name: name || issuer || 'Imported Account',
            issuer: issuer || undefined,
            algorithm,
            digits: digitsCode === 2 ? 8 : 6,
            type: typeCode === 1 ? 'hotp' : 'totp'
          });
        }
      } else if (wireType === 0) {
        const { newOffset: afterVar } = decodeVarint(rawBytes, pos);
        pos = afterVar;
      } else if (wireType === 2) {
        const { value: len, newOffset: afterLen } = decodeVarint(rawBytes, pos);
        pos = afterLen + len;
      } else {
        pos++;
      }
    }
  } catch {
    // Return whatever accounts were parsed up to the error
  }

  return accounts;
}
