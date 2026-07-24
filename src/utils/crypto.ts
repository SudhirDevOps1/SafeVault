import { argon2id } from 'hash-wasm';

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

export function generateRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr as Uint8Array<ArrayBuffer>;
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

export function generateSalt(): string {
  return bufferToBase64(generateRandomBytes(SALT_LENGTH));
}

export function generateIV(): string {
  return bufferToBase64(generateRandomBytes(IV_LENGTH));
}

export async function deriveKey(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const salt = base64ToBuffer(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createVerificationHash(
  password: string,
  saltBase64: string
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const salt = base64ToBuffer(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    256
  );

  return bufferToBase64(bits);
}

export async function deriveKeyArgon2id(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const salt = base64ToBuffer(saltBase64);
  const hashBytes = await argon2id({
    password: password,
    salt: salt,
    iterations: 3,
    memorySize: 65536, // 64 MB
    parallelism: 4,
    hashLength: 32, // 256 bits
    outputType: 'binary',
  });

  return crypto.subtle.importKey(
    'raw',
    hashBytes,
    { name: 'AES-GCM' },
    true, // Set to true to allow key wrapping for recovery phrases
    ['encrypt', 'decrypt']
  );
}

export async function createVerificationHashArgon2id(
  password: string,
  saltBase64: string
): Promise<string> {
  const salt = base64ToBuffer(saltBase64);
  return argon2id({
    password: password,
    salt: salt,
    iterations: 3,
    memorySize: 65536, // 64 MB
    parallelism: 4,
    hashLength: 32,
    outputType: 'hex',
  });
}

export async function deriveKeyFromRecoveryPhrase(
  recoveryPhrase: string,
  saltBase64: string
): Promise<CryptoKey> {
  const cleanPhrase = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  return deriveKeyArgon2id(cleanPhrase, saltBase64);
}

export async function wrapKey(
  masterKey: CryptoKey,
  recoveryKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const rawKey = await crypto.subtle.exportKey('raw', masterKey);
  const iv = generateRandomBytes(IV_LENGTH);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    recoveryKey,
    rawKey
  );
  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  };
}

export async function unwrapKey(
  wrappedKeyBase64: string,
  ivBase64: string,
  recoveryKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKey = base64ToBuffer(wrappedKeyBase64);
  const iv = base64ToBuffer(ivBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    recoveryKey,
    wrappedKey
  );
  return crypto.subtle.importKey(
    'raw',
    decrypted,
    { name: 'AES-GCM' },
    true, // Make extracted master key extractable again
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const iv = generateRandomBytes(IV_LENGTH);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    dataBuffer
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  };
}

export async function decrypt(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToBuffer(ciphertextBase64);
  const iv = base64ToBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 20) score++;
  
  if (/^[a-zA-Z]+$/.test(password)) score = Math.max(score - 1, 0);
  if (/^[0-9]+$/.test(password)) score = Math.max(score - 2, 0);
  if (/(.)\1{2,}/.test(password)) score = Math.max(score - 1, 0);
  
  const normalizedScore = Math.min(Math.floor(score * 4 / 7), 4);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

  return {
    score: normalizedScore,
    label: labels[normalizedScore],
    color: colors[normalizedScore],
  };
}

export function generateId(): string {
  const bytes = generateRandomBytes(16);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
