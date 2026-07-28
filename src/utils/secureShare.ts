import { argon2id } from 'hash-wasm';
import { base64ToBuffer, bufferToBase64 } from './crypto';

export interface SecureVaultPackage {
  format: 'SFV-2.0';
  salt: string;          // KEK Salt
  iv: string;            // Content Key IV
  encrypted_key: string; // Content Key encrypted with KEK
  data: string;          // Credentials encrypted with Content Key
  expiresAt?: number;    // Expiration timestamp (optional)
}

/**
 * Creates a double-layer encrypted .svault package from raw credentials.
 * Layer 1: Encrypt data with a random 256-bit Content Key.
 * Layer 2: Encrypt Content Key using a Key Encryption Key (KEK) derived from a share password + salt via Argon2id.
 */
export async function exportSharedVault(
  credentials: any[],
  sharePassword: string,
  expiresInDays?: number
): Promise<string> {
  if (sharePassword.length < 12) {
    throw new Error('Sharing password must be at least 12 characters long');
  }

  // 1. Generate random 256-bit (32-byte) Content Key
  const contentKeyBytes = new Uint8Array(32);
  window.crypto.getRandomValues(contentKeyBytes);

  // Import Content Key for WebCrypto
  const contentKey = await window.crypto.subtle.importKey(
    'raw',
    contentKeyBytes,
    { name: 'AES-GCM' },
    true,
    ['encrypt']
  );

  // Serialize and Encrypt Data (Layer 1)
  const dataString = JSON.stringify(credentials);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const contentIv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: contentIv },
    contentKey,
    dataBuffer
  );

  // Combined ciphertext base64 matches original schema format structure
  const dataBase64 = bufferToBase64(encryptedData);

  // 2. Derive KEK using sharePassword + salt via Argon2id (Layer 2)
  const kekSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const kekSaltBase64 = bufferToBase64(kekSalt);

  const hashBytes = await argon2id({
    password: sharePassword,
    salt: kekSalt,
    iterations: 3,
    memorySize: 65536, // 64 MB
    parallelism: 4,
    hashLength: 32, // 256 bits
    outputType: 'binary',
  });

  const kek = await window.crypto.subtle.importKey(
    'raw',
    hashBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Securely scrub derived hashBytes from RAM memory
  hashBytes.fill(0);

  // Encrypt Content Key using KEK (Layer 2 wrapping)
  const kekIv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: kekIv },
    kek,
    contentKeyBytes
  );

  // Scrub plain Content Key bytes from RAM
  contentKeyBytes.fill(0);

  const pkg: SecureVaultPackage = {
    format: 'SFV-2.0',
    salt: kekSaltBase64,
    iv: bufferToBase64(contentIv),
    encrypted_key: bufferToBase64(new Uint8Array(encryptedKeyBuffer)),
    data: dataBase64,
  };

  if (expiresInDays && expiresInDays > 0) {
    pkg.expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  }

  // Double layer wrap containing KEK IV (prepended to encrypted key bytes for wrapping unwrap compatibility)
  const wrapperPkg = {
    ...pkg,
    kek_iv: bufferToBase64(kekIv)
  };

  return JSON.stringify(wrapperPkg, null, 2);
}

/**
 * Decrypts a double-layer encrypted .svault package and parses its contents.
 */
export async function importSharedVault(
  pkgJson: string,
  sharePassword: string
): Promise<{ credentials: any[]; isExpired: boolean }> {
  const pkg = JSON.parse(pkgJson);

  if (pkg.format !== 'SFV-2.0') {
    throw new Error('Unsupported vault package format');
  }

  // Check expiration date
  if (pkg.expiresAt && Date.now() > pkg.expiresAt) {
    return { credentials: [], isExpired: true };
  }

  const kekSalt = base64ToBuffer(pkg.salt);
  const kekIv = base64ToBuffer(pkg.kek_iv);
  const encryptedKey = base64ToBuffer(pkg.encrypted_key);
  const contentIv = base64ToBuffer(pkg.iv);
  const encryptedData = base64ToBuffer(pkg.data);

  // 1. Derive KEK via Argon2id using password + salt
  const hashBytes = await argon2id({
    password: sharePassword,
    salt: kekSalt,
    iterations: 3,
    memorySize: 65536,
    parallelism: 4,
    hashLength: 32,
    outputType: 'binary',
  });

  const kek = await window.crypto.subtle.importKey(
    'raw',
    hashBytes as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  hashBytes.fill(0);

  // 2. Decrypt Content Key using KEK
  const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: kekIv },
    kek,
    encryptedKey
  );

  const contentKey = await window.crypto.subtle.importKey(
    'raw',
    decryptedKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Scrub Content Key buffer
  new Uint8Array(decryptedKeyBuffer).fill(0);

  // 3. Decrypt data payload using Content Key
  const decryptedDataBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: contentIv },
    contentKey,
    encryptedData
  );

  const dataString = new TextDecoder().decode(decryptedDataBuffer);
  return { credentials: JSON.parse(dataString), isExpired: false };
}
