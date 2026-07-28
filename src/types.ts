// SafeVault Type Definitions

export interface Credential {
  id: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  totpSecret: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  // Payment Card fields (optional — only for category === 'Payment Card')
  cardNumber?: string;       // Stored encrypted as part of vault blob
  cardHolder?: string;
  cardExpiry?: string;       // Format: MM/YY
  cardCVV?: string;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'rupay' | 'other';
  // Passkey fields (optional — only for category === 'Passkey')
  passkeyId?: string;
  passkeyRpId?: string;      // Relying party domain (e.g. google.com)
  passkeyUsername?: string;
  passkeyPublicKey?: string; // Base64 public key
  passkeyPrivateKey?: string; // Private key (optional mockup storage)
}

export interface VaultMetadata {
  id: string;
  salt: string;             // Base64-encoded salt for PBKDF2
  iv: string;               // Base64-encoded IV for AES-GCM
  verificationHash: string; // Hash to verify master password
  verificationSalt: string; // Salt for verification hash
  createdAt: number;
  updatedAt: number;
  autoLockMinutes: number;
  version: number;
  kdf?: 'pbkdf2' | 'argon2id'; // Key derivation function used
}

// Sync payload wrapper — carries credentials + tombstone deleted IDs
// so that deletes propagate correctly across devices (no ghost resurrections)
export interface SyncPayload {
  credentials: Credential[];
  deletedIds: string[];      // Credential IDs deleted on sender device
  syncedAt: number;          // Unix timestamp of sync initiation
}

export interface EncryptedVault {
  id: string;
  data: string; // Base64-encoded encrypted blob
  metadata: VaultMetadata;
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean;
}

export type VaultState = 'loading' | 'setup' | 'locked' | 'unlocked';
export type SidebarView = 'all' | 'favorites' | 'trash' | 'generator' | 'settings' | 'aliases' | 'cards' | 'health' | 'share';

export interface WrappedKeyData {
  ciphertext: string;
  iv: string;
  salt: string;
}

// Password Health types
export interface PasswordHealthIssue {
  credentialId: string;
  title: string;
  type: 'weak' | 'reused' | 'old' | 'no_2fa' | 'breached';
  severity: 'critical' | 'warning' | 'info';
  detail?: string;
}

export interface HealthReport {
  score: number;            // 0–100
  totalCredentials: number;
  issues: PasswordHealthIssue[];
  weakCount: number;
  reusedCount: number;
  oldCount: number;
  no2faCount: number;
  breachedCount: number;
}

// Secure Share types
export interface SharePayload {
  version: 1;
  credential: Pick<Credential, 'title' | 'url' | 'username' | 'password' | 'notes' | 'totpSecret'>;
  expiresAt: number;        // Unix timestamp (24h from creation)
}
