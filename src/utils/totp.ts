/**
 * SafeVault TOTP (Time-based One-Time Password) Implementation
 * 
 * Implements RFC 6238 TOTP using Web Crypto API HMAC-SHA1.
 * No external dependencies required.
 */

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;

/** Decode Base32 string to Uint8Array */
function base32Decode(base32: string): Uint8Array<ArrayBuffer> {
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
  // JavaScript numbers are 64-bit floats; for TOTP we need the counter as 8 bytes
  view.setUint32(0, Math.floor(num / 0x100000000));
  view.setUint32(4, num & 0xffffffff);
  return buffer;
}

/** Generate HMAC-SHA1 */
async function hmacSha1(key: Uint8Array<ArrayBuffer>, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, data);
}

/** Dynamic truncation as per RFC 4226 */
function dynamicTruncation(hmacResult: ArrayBuffer): number {
  const bytes = new Uint8Array(hmacResult);
  const offset = bytes[bytes.length - 1] & 0x0f;
  const code =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  return code % Math.pow(10, TOTP_DIGITS);
}

/** Generate a TOTP code from a Base32 secret */
export async function generateTOTP(secret: string): Promise<string> {
  if (!secret || secret.trim().length === 0) return '';
  
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    const counterBytes = intToBytes(counter);
    const hmac = await hmacSha1(key, counterBytes);
    const code = dynamicTruncation(hmac);
    return code.toString().padStart(TOTP_DIGITS, '0');
  } catch {
    return 'ERROR';
  }
}

/** Get seconds remaining in current TOTP period */
export function getTOTPTimeRemaining(): number {
  return TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD);
}

/** Get the TOTP period */
export function getTOTPPeriod(): number {
  return TOTP_PERIOD;
}

/** Validate a Base32 TOTP secret */
export function isValidTOTPSecret(secret: string): boolean {
  if (!secret || secret.trim().length === 0) return false;
  const cleaned = secret.replace(/[\s=-]/g, '').toUpperCase();
  return /^[A-Z2-7]+$/.test(cleaned) && cleaned.length >= 16;
}
