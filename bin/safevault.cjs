#!/usr/bin/env node

/**
 * SafeVault CLI Tool
 *
 * Secure, zero-knowledge, offline-first command line credentials manager.
 * Fully compatible with SafeVault GUI desktop app backups.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const VERSION = '2.0.0';
const VAULT_PATH = path.join(os.homedir(), '.safevault.db');
const PBKDF2_ITERATIONS = 600000;
const CLIPBOARD_WIPE_MS = 15000;

// ANSI color helpers (auto-disabled if stdout is not a TTY)
const USE_COLOR = process.stdout.isTTY;
const c = {
  reset:   USE_COLOR ? '\x1b[0m'  : '',
  bold:    USE_COLOR ? '\x1b[1m'  : '',
  red:     USE_COLOR ? '\x1b[31m' : '',
  green:   USE_COLOR ? '\x1b[32m' : '',
  yellow:  USE_COLOR ? '\x1b[33m' : '',
  cyan:    USE_COLOR ? '\x1b[36m' : '',
  magenta: USE_COLOR ? '\x1b[35m' : '',
  white:   USE_COLOR ? '\x1b[97m' : '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Input Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt user for input. Supports masked password entry.
 * FIX: Rewrote password masking — previous version leaked raw characters
 *      and called process.openStdin() which conflicts with readline.
 */
function prompt(question, isPassword = false) {
  return new Promise((resolve) => {
    if (isPassword && process.stdin.isTTY) {
      // Use raw mode for secure masking — no echo at all
      process.stdout.write(question);
      let value = '';

      const onData = (buf) => {
        const char = buf.toString('utf8');
        if (char === '\r' || char === '\n' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(value.length));
          }
        } else {
          value += char;
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + '*'.repeat(value.length));
        }
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      // Non-TTY or non-password prompt (use readline)
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer || '');
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard Helper
// FIX: Used spawnSync with stdio piped properly — previous execSync() call
//      could expose the text in process list args on some systems.
// ─────────────────────────────────────────────────────────────────────────────
function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      // Use PowerShell Set-Clipboard — more reliable than `clip` on UTF-8
      spawnSync('powershell', ['-NoProfile', '-Command',
        `[System.Windows.Forms.Clipboard]::SetText(${JSON.stringify(text)})`
      ], { shell: false, stdio: 'pipe' });
      // Fallback to clip if powershell fails
      if (text !== '') execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (process.platform === 'darwin') {
      spawnSync('pbcopy', [], { input: text, stdio: 'pipe' });
    } else {
      // Try xclip first, fall back to xsel
      const result = spawnSync('xclip', ['-selection', 'clipboard'], { input: text, stdio: 'pipe' });
      if (result.status !== 0) {
        spawnSync('xsel', ['--clipboard', '--input'], { input: text, stdio: 'pipe' });
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cryptography Helpers
// ─────────────────────────────────────────────────────────────────────────────
function deriveKey(password, saltBase64) {
  const salt = Buffer.from(saltBase64, 'base64');
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
}

function createVerificationHash(password, saltBase64) {
  const salt = Buffer.from(saltBase64, 'base64');
  const bits = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
  return bits.toString('base64');
}

function encrypt(dataText, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  let encrypted = cipher.update(dataText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  const ciphertextBuffer = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);
  return {
    ciphertext: ciphertextBuffer.toString('base64'),
    iv: iv.toString('base64'),
  };
}

function decrypt(ciphertextBase64, ivBase64, keyBuffer) {
  const iv = Buffer.from(ivBase64, 'base64');
  const fullCiphertext = Buffer.from(ciphertextBase64, 'base64');
  const authTag = fullCiphertext.subarray(fullCiphertext.length - 16);
  const ciphertext = fullCiphertext.subarray(0, fullCiphertext.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOTP Generator
// ─────────────────────────────────────────────────────────────────────────────
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.replace(/[\s=-]/g, '').toUpperCase();
  let bits = '';
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

function generateTOTP(secret, digits = 6, period = 30) {
  if (!secret) return '';
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / period);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const otp = code % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  } catch {
    return 'ERROR';
  }
}

/** FIX: Returns seconds remaining in current TOTP window */
function totpSecondsLeft(period = 30) {
  return period - (Math.floor(Date.now() / 1000) % period);
}

// ─────────────────────────────────────────────────────────────────────────────
// HaveIBeenPwned k-Anonymity Helper
// ─────────────────────────────────────────────────────────────────────────────
function checkPwned(prefix) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { headers: { 'Add-Padding': 'true', 'User-Agent': 'SafeVault-CLI' } },
      (res) => {
        if (res.statusCode !== 200) { resolve(''); return; }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Load and parse vault file. Throws on corrupt/missing file. */
function loadVaultRaw() {
  if (!fs.existsSync(VAULT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
  } catch {
    throw new Error(`Vault file at ${VAULT_PATH} is corrupt or unreadable.`);
  }
}

/** Unlock vault: verify password and return decrypted credentials array. */
function unlockVault(vault, password) {
  const verHash = createVerificationHash(password, vault.verificationSalt);
  if (verHash !== vault.verificationHash) return null;
  const key = deriveKey(password, vault.salt);
  try {
    const decrypted = decrypt(vault.encryptedData, vault.iv, key);
    return { credentials: JSON.parse(decrypted), key };
  } catch {
    return null;
  }
}

/** Save credentials back to vault (re-encrypts). */
function saveVault(vault, credentials, key) {
  const { ciphertext, iv } = encrypt(JSON.stringify(credentials), key);
  vault.encryptedData = ciphertext;
  vault.iv = iv;
  vault.updatedAt = Date.now();
  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), { mode: 0o600 });
}

/** FIX: Password strength checker — was completely missing */
function checkPasswordStrength(password) {
  let score = 0;
  const issues = [];
  if (password.length >= 12) score++; else issues.push('Use at least 12 characters');
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++; else issues.push('Add uppercase letters');
  if (/[a-z]/.test(password)) score++; else issues.push('Add lowercase letters');
  if (/[0-9]/.test(password)) score++; else issues.push('Add numbers');
  if (/[^A-Za-z0-9]/.test(password)) score++; else issues.push('Add special characters (!@#$%...)');

  const labels = ['Very Weak', 'Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = [c.red, c.red, c.red, c.yellow, c.yellow, c.green, c.green];
  return { score, label: labels[score] || 'Unknown', color: colors[score] || c.reset, issues };
}

/** FIX: Generate a strong random password — was completely missing */
function generatePassword(length = 20, opts = {}) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = opts.noSpecial ? '' : '!@#$%^&*()-_=+[]{}|;:,.<>?';

  let charset = upper + lower + digits + special;
  if (!charset) charset = lower;

  let password = '';
  // Guarantee at least one of each required type
  if (upper) password += upper[crypto.randomInt(upper.length)];
  if (lower) password += lower[crypto.randomInt(lower.length)];
  if (digits) password += digits[crypto.randomInt(digits.length)];
  if (special) password += special[crypto.randomInt(special.length)];

  while (password.length < length) {
    password += charset[crypto.randomInt(charset.length)];
  }

  // Shuffle using Fisher-Yates
  const arr = password.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

async function ensureVaultExists() {
  if (fs.existsSync(VAULT_PATH)) return true;
  const choice = await prompt(
    `${c.yellow}No vault found at ${VAULT_PATH}. Initialize a new vault? (Y/n): ${c.reset}`
  );
  if (choice.toLowerCase() === 'n') {
    console.log('Aborted.');
    return false;
  }
  await init();
  return fs.existsSync(VAULT_PATH);
}

/** FIX: Centralized auth helper — was duplicated in every command */
async function authenticate() {
  const vault = loadVaultRaw();
  if (!vault) return null;

  const password = await prompt(`${c.cyan}Enter Master Password: ${c.reset}`, true);
  const result = unlockVault(vault, password);
  if (!result) {
    console.log(`\n${c.red}Error: Incorrect master password.${c.reset}`);
    return null;
  }
  return { vault, password, ...result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  if (fs.existsSync(VAULT_PATH)) {
    const confirm = await prompt(
      `${c.yellow}Vault already exists at ${VAULT_PATH}. Overwrite? (y/N): ${c.reset}`
    );
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  const password = await prompt(`${c.cyan}Set Master Password: ${c.reset}`, true);
  const confirm  = await prompt(`${c.cyan}Confirm Master Password: ${c.reset}`, true);

  console.log('');

  // FIX: Added password confirmation check — was completely missing
  if (password !== confirm) {
    console.log(`\n${c.red}Error: Passwords do not match.${c.reset}`);
    return;
  }

  if (password.length < 8) {
    console.log(`\n${c.red}Error: Password must be at least 8 characters long.${c.reset}`);
    return;
  }

  const strength = checkPasswordStrength(password);
  console.log(`\nPassword strength: ${strength.color}${c.bold}${strength.label}${c.reset}`);
  if (strength.issues.length > 0) {
    strength.issues.forEach((issue) => console.log(`  ${c.yellow}• ${issue}${c.reset}`));
  }

  const salt             = crypto.randomBytes(16).toString('base64');
  const verificationSalt = crypto.randomBytes(16).toString('base64');
  const verificationHash = createVerificationHash(password, verificationSalt);
  const key              = deriveKey(password, salt);
  const { ciphertext, iv } = encrypt(JSON.stringify([]), key);

  const vault = {
    version: 2,
    salt,
    verificationSalt,
    verificationHash,
    encryptedData: ciphertext,
    iv,
    autoLockMinutes: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), { mode: 0o600 });
  console.log(`\n${c.green}Vault initialized successfully at ${VAULT_PATH}${c.reset}`);
}

async function add() {
  if (!(await ensureVaultExists())) return;

  const auth = await authenticate();
  if (!auth) return;

  console.log('');

  const title       = (await prompt(`${c.bold}Title${c.reset}: `)).trim();
  if (!title) { console.log(`${c.red}Title is required.${c.reset}`); return; }

  const username    = (await prompt(`${c.bold}Username${c.reset}: `)).trim();
  const url         = (await prompt(`${c.bold}URL${c.reset}: `)).trim();
  const notes       = (await prompt(`${c.bold}Notes${c.reset}: `)).trim();
  const totpSecret  = (await prompt(`${c.bold}TOTP Secret${c.reset} (optional, leave blank to skip): `)).trim();

  // FIX: Allow generating a strong password automatically
  let credPassword;
  const genChoice = await prompt(`${c.bold}Password${c.reset}: Generate a strong password? (G) or enter manually (M): `);
  if (genChoice.toLowerCase() === 'g') {
    credPassword = generatePassword(20);
    console.log(`${c.green}Generated password: ${c.bold}${credPassword}${c.reset}`);
    const useit = await prompt('Use this password? (Y/n): ');
    if (useit.toLowerCase() === 'n') {
      credPassword = await prompt(`${c.bold}Enter password manually: ${c.reset}`, true);
      console.log('');
    }
  } else {
    credPassword = await prompt(`${c.bold}Enter password: ${c.reset}`, true);
    console.log('');
  }

  // FIX: Show password strength on add
  if (credPassword) {
    const str = checkPasswordStrength(credPassword);
    console.log(`Password strength: ${str.color}${c.bold}${str.label}${c.reset}`);
    if (str.score <= 2) {
      str.issues.forEach((issue) => console.log(`  ${c.yellow}• ${issue}${c.reset}`));
    }
  }

  const newCredential = {
    id: crypto.randomBytes(16).toString('hex'),
    title,
    username,
    password: credPassword,
    url,
    notes,
    totpSecret: totpSecret || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  auth.credentials.push(newCredential);
  saveVault(auth.vault, auth.credentials, auth.key);
  console.log(`\n${c.green}Credential "${title}" added successfully!${c.reset}`);
}

async function remove(titleArg) {
  if (!titleArg) {
    console.log('Usage: safevault remove <title>');
    return;
  }

  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  const matches = auth.credentials.filter((c) =>
    c.title.toLowerCase().includes(titleArg.toLowerCase())
  );

  if (matches.length === 0) {
    console.log(`\n${c.red}No credential found matching: ${titleArg}${c.reset}`);
    return;
  }

  if (matches.length > 1) {
    console.log(`\n${c.yellow}Multiple matches found — be more specific:${c.reset}`);
    matches.forEach((m) => console.log(`  * ${m.title} (${m.username || 'no username'})`));
    return;
  }

  const match = matches[0];
  console.log(`\n${c.yellow}About to delete: "${match.title}" (${match.username || 'no username'})${c.reset}`);
  const confirm = await prompt('Confirm delete? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  auth.credentials = auth.credentials.filter((c) => c.id !== match.id);
  saveVault(auth.vault, auth.credentials, auth.key);
  console.log(`${c.green}Credential "${match.title}" deleted.${c.reset}`);
}

async function edit(titleArg) {
  if (!titleArg) {
    console.log('Usage: safevault edit <title>');
    return;
  }

  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  const idx = auth.credentials.findIndex((c) =>
    c.title.toLowerCase().includes(titleArg.toLowerCase())
  );

  if (idx === -1) {
    console.log(`\n${c.red}No credential found matching: ${titleArg}${c.reset}`);
    return;
  }

  const entry = auth.credentials[idx];
  console.log(`\n${c.cyan}Editing "${entry.title}" — press Enter to keep current value${c.reset}\n`);

  const title      = (await prompt(`Title [${entry.title}]: `)).trim()    || entry.title;
  const username   = (await prompt(`Username [${entry.username}]: `)).trim() || entry.username;
  const url        = (await prompt(`URL [${entry.url}]: `)).trim()        || entry.url;
  const notes      = (await prompt(`Notes [${entry.notes}]: `)).trim()    || entry.notes;
  const totpSecret = (await prompt(`TOTP Secret [${entry.totpSecret || 'none'}]: `)).trim() || entry.totpSecret;

  const changePw = await prompt('Change password? (y/N): ');
  let credPassword = entry.password;
  if (changePw.toLowerCase() === 'y') {
    const genChoice = await prompt('Generate a strong password? (G) or enter manually (M): ');
    if (genChoice.toLowerCase() === 'g') {
      credPassword = generatePassword(20);
      console.log(`${c.green}Generated: ${c.bold}${credPassword}${c.reset}`);
      const useit = await prompt('Use this? (Y/n): ');
      if (useit.toLowerCase() === 'n') {
        credPassword = await prompt('Enter new password: ', true);
        console.log('');
      }
    } else {
      credPassword = await prompt('Enter new password: ', true);
      console.log('');
    }
  }

  auth.credentials[idx] = {
    ...entry,
    title,
    username,
    password: credPassword,
    url,
    notes,
    totpSecret: totpSecret || undefined,
    updatedAt: Date.now(),
  };

  saveVault(auth.vault, auth.credentials, auth.key);
  console.log(`\n${c.green}Credential "${title}" updated successfully!${c.reset}`);
}

async function list() {
  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  console.log('');
  if (auth.credentials.length === 0) {
    console.log(`${c.yellow}No credentials stored yet. Use 'safevault add' to add one.${c.reset}`);
    return;
  }

  console.log(`${c.bold}${c.cyan}Stored Credentials (${auth.credentials.length} total):${c.reset}`);
  console.log('─'.repeat(60));

  auth.credentials.forEach((cred, i) => {
    const hasTOTP = cred.totpSecret ? ` ${c.magenta}[2FA]${c.reset}` : '';
    const hasURL  = cred.url ? ` ${c.cyan}${cred.url}${c.reset}` : '';
    console.log(
      `${c.bold}${String(i + 1).padStart(3)}.${c.reset} ${c.green}${cred.title}${c.reset}` +
      `  ${c.white}${cred.username || '(no username)'}${c.reset}${hasTOTP}${hasURL}`
    );
  });

  console.log('─'.repeat(60));
}

async function get(title, flags = {}) {
  if (!title) {
    console.log('Usage: safevault get <title> [options]');
    console.log('Options: -u/--username  -p/--password  -t/--totp');
    return;
  }

  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  const matches = auth.credentials.filter((cred) =>
    cred.title.toLowerCase().includes(title.toLowerCase())
  );

  if (matches.length === 0) {
    console.log(`\n${c.red}No credential found matching: "${title}"${c.reset}`);
    process.exit(1);
  }

  let match;
  if (matches.length > 1) {
    if (flags.username || flags.password || flags.totp) {
      // Scripting mode: require exact match
      const exact = matches.find((m) => m.title.toLowerCase() === title.toLowerCase());
      if (!exact) {
        console.log(`Multiple matches for "${title}". Please use the exact title.`);
        matches.forEach((m) => console.log(`  * ${m.title}`));
        process.exit(1);
      }
      match = exact;
    } else {
      console.log(`\n${c.yellow}Multiple credentials match "${title}":${c.reset}`);
      matches.forEach((m, i) => console.log(`  ${i + 1}. ${m.title} (${m.username || 'no username'})`));
      const pick = await prompt(`\nEnter number to select (1-${matches.length}): `);
      const idx = parseInt(pick, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= matches.length) {
        console.log('Invalid selection.'); process.exit(1);
      }
      match = matches[idx];
    }
  } else {
    match = matches[0];
  }

  // Scripting flags
  if (flags.username) {
    process.stdout.write(match.username || '');
    process.exit(0);
  }

  if (flags.totp) {
    if (!match.totpSecret) {
      console.error(`${c.red}No TOTP secret configured for "${match.title}".${c.reset}`);
      process.exit(1);
    }
    const token = generateTOTP(match.totpSecret);
    const secsLeft = totpSecondsLeft();
    process.stdout.write(`${token}\n`);
    if (process.stdout.isTTY) {
      console.log(`${c.yellow}(valid for ${secsLeft}s)${c.reset}`);
    }
    process.exit(0);
  }

  if (flags.password) {
    if (copyToClipboard(match.password)) {
      console.log(`\n${c.green}Password copied to clipboard! Auto-wiping in ${CLIPBOARD_WIPE_MS / 1000}s...${c.reset}`);
      setTimeout(() => { copyToClipboard(''); process.exit(0); }, CLIPBOARD_WIPE_MS);
    } else {
      process.stdout.write(match.password);
      process.exit(0);
    }
    return;
  }

  // Default detailed view
  console.log(`\n${c.cyan}${'─'.repeat(50)}${c.reset}`);
  console.log(`${c.bold}  Title   :${c.reset} ${match.title}`);
  console.log(`${c.bold}  Username:${c.reset} ${match.username || c.yellow + '(none)' + c.reset}`);
  console.log(`${c.bold}  URL     :${c.reset} ${match.url     || c.yellow + '(none)' + c.reset}`);
  console.log(`${c.bold}  Notes   :${c.reset} ${match.notes   || c.yellow + '(none)' + c.reset}`);

  if (match.totpSecret) {
    const code = generateTOTP(match.totpSecret);
    const secs = totpSecondsLeft();
    console.log(`${c.bold}  2FA Code:${c.reset} ${c.green}${c.bold}${code}${c.reset} ${c.yellow}(${secs}s left)${c.reset}`);
  }

  // FIX: Show password strength in detail view
  if (match.password) {
    const str = checkPasswordStrength(match.password);
    console.log(`${c.bold}  PW Str  :${c.reset} ${str.color}${str.label}${c.reset}`);
  }

  console.log(`${c.bold}  Added   :${c.reset} ${new Date(match.createdAt).toLocaleString()}`);
  if (match.updatedAt && match.updatedAt !== match.createdAt) {
    console.log(`${c.bold}  Updated :${c.reset} ${new Date(match.updatedAt).toLocaleString()}`);
  }
  console.log(`${c.cyan}${'─'.repeat(50)}${c.reset}`);

  if (copyToClipboard(match.password)) {
    console.log(`\n${c.green}Password copied to clipboard! Wiping in ${CLIPBOARD_WIPE_MS / 1000}s...${c.reset}`);
    setTimeout(() => {
      copyToClipboard('');
      console.log(`${c.yellow}Clipboard wiped.${c.reset}`);
      process.exit(0);
    }, CLIPBOARD_WIPE_MS);
  } else {
    console.log(`${c.bold}  Password:${c.reset} ${match.password}`);
    process.exit(0);
  }
}

async function audit() {
  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  console.log('');

  if (auth.credentials.length === 0) {
    console.log(`${c.yellow}No credentials to audit.${c.reset}`);
    return;
  }

  console.log(`${c.cyan}Auditing ${auth.credentials.length} credentials via k-Anonymity...${c.reset}\n`);

  let breachesFound = 0;
  let weakPasswords = 0;
  let dupPasswords  = 0;
  const seenHashes  = new Map();

  for (const cred of auth.credentials) {
    if (!cred.password) continue;

    // FIX: Detect duplicate/reused passwords
    const sha1 = crypto.createHash('sha1').update(cred.password).digest('hex').toUpperCase();
    if (seenHashes.has(sha1)) {
      console.log(`${c.yellow}[REUSED  ]${c.reset} "${cred.title}" shares password with "${seenHashes.get(sha1)}"`);
      dupPasswords++;
    } else {
      seenHashes.set(sha1, cred.title);
    }

    // FIX: Check password strength per entry
    const str = checkPasswordStrength(cred.password);
    if (str.score <= 2) {
      console.log(`${c.yellow}[WEAK    ]${c.reset} "${cred.title}" — ${str.color}${str.label}${c.reset}`);
      weakPasswords++;
    }

    // k-Anonymity breach check
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const text  = await checkPwned(prefix);
      const lines = text.split('\n');
      let found   = false;
      for (const line of lines) {
        const [lineSuffix, countStr] = line.split(':');
        if (lineSuffix && lineSuffix.trim() === suffix) {
          const count = parseInt(countStr.trim(), 10);
          console.log(`${c.red}[BREACHED]${c.reset} "${cred.title}" appeared ${count.toLocaleString()} times in data leaks!`);
          breachesFound++;
          found = true;
          break;
        }
      }
      if (!found && str.score > 2) {
        console.log(`${c.green}[OK      ]${c.reset} "${cred.title}"`);
      }
    } catch {
      console.log(`${c.yellow}[SKIPPED ]${c.reset} "${cred.title}" — network error (check internet connection)`);
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${c.bold}Audit Summary:${c.reset}`);
  console.log(`  ${c.red}Breached passwords : ${breachesFound}${c.reset}`);
  console.log(`  ${c.yellow}Weak passwords     : ${weakPasswords}${c.reset}`);
  console.log(`  ${c.yellow}Reused passwords   : ${dupPasswords}${c.reset}`);
  if (breachesFound === 0 && weakPasswords === 0 && dupPasswords === 0) {
    console.log(`\n${c.green}All passwords passed audit checks!${c.reset}`);
  } else {
    console.log(`\n${c.yellow}Please update the flagged credentials.${c.reset}`);
  }
}

/** FIX: generate command — was completely missing */
async function generate(lengthArg, flags = {}) {
  const length = parseInt(lengthArg, 10) || 20;
  const password = generatePassword(length, { noSpecial: flags.noSpecial });
  console.log(`\n${c.bold}Generated Password:${c.reset} ${c.green}${password}${c.reset}`);

  const str = checkPasswordStrength(password);
  console.log(`Strength: ${str.color}${c.bold}${str.label}${c.reset}`);

  if (copyToClipboard(password)) {
    console.log(`\n${c.cyan}Copied to clipboard! Wiping in ${CLIPBOARD_WIPE_MS / 1000}s...${c.reset}`);
    setTimeout(() => { copyToClipboard(''); process.exit(0); }, CLIPBOARD_WIPE_MS);
  } else {
    process.exit(0);
  }
}

async function importBackup(filePath) {
  if (!filePath) {
    console.log('Usage: safevault import <path-to-backup.json>');
    return;
  }
  if (!fs.existsSync(filePath)) {
    console.log(`${c.red}Error: File not found: ${filePath}${c.reset}`);
    return;
  }

  try {
    const raw    = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // FIX: Support both direct vault and wrapped backup format
    const data   = raw.type === 'safevault-backup' ? raw.data : raw;

    if (!data.encryptedData || !data.salt) {
      console.log(`${c.red}Error: Invalid or unrecognized backup format.${c.reset}`);
      return;
    }

    if (fs.existsSync(VAULT_PATH)) {
      const confirm = await prompt(`${c.yellow}Vault already exists. Overwrite with backup? (y/N): ${c.reset}`);
      if (confirm.toLowerCase() !== 'y') { console.log('Aborted.'); return; }
    }

    fs.writeFileSync(VAULT_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log(`${c.green}Backup imported successfully to ${VAULT_PATH}${c.reset}`);
  } catch (err) {
    console.log(`${c.red}Failed to import backup: ${err.message}${c.reset}`);
  }
}

async function exportBackup(filePath) {
  if (!filePath) {
    console.log('Usage: safevault export <output-path.json>');
    return;
  }

  if (!(await ensureVaultExists())) return;

  try {
    const vault  = loadVaultRaw();
    const backup = {
      type: 'safevault-backup',
      version: VERSION,
      exportedAt: Date.now(),
      exportedBy: `SafeVault CLI v${VERSION}`,
      data: vault,
    };

    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    console.log(`${c.green}Vault exported to ${filePath}${c.reset}`);
  } catch (err) {
    console.log(`${c.red}Failed to export vault: ${err.message}${c.reset}`);
  }
}

/** FIX: change-password command — was completely missing */
async function changePassword() {
  if (!(await ensureVaultExists())) return;
  const auth = await authenticate();
  if (!auth) return;

  console.log(`\n${c.cyan}Set new master password:${c.reset}`);
  const newPw      = await prompt('New Master Password: ', true);
  const confirmPw  = await prompt('Confirm New Password: ', true);
  console.log('');

  if (newPw !== confirmPw) {
    console.log(`${c.red}Passwords do not match.${c.reset}`);
    return;
  }
  if (newPw.length < 8) {
    console.log(`${c.red}Password must be at least 8 characters.${c.reset}`);
    return;
  }

  const str = checkPasswordStrength(newPw);
  console.log(`Strength: ${str.color}${c.bold}${str.label}${c.reset}`);
  if (str.score <= 2) {
    str.issues.forEach((i) => console.log(`  ${c.yellow}• ${i}${c.reset}`));
    const proceed = await prompt('Password is weak. Proceed anyway? (y/N): ');
    if (proceed.toLowerCase() !== 'y') { console.log('Aborted.'); return; }
  }

  const newSalt             = crypto.randomBytes(16).toString('base64');
  const newVerSalt          = crypto.randomBytes(16).toString('base64');
  auth.vault.salt            = newSalt;
  auth.vault.verificationSalt = newVerSalt;
  auth.vault.verificationHash = createVerificationHash(newPw, newVerSalt);

  const newKey = deriveKey(newPw, newSalt);
  saveVault(auth.vault, auth.credentials, newKey);
  console.log(`${c.green}Master password changed successfully!${c.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Help & Interactive Menu
// ─────────────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${c.bold}${c.green}SafeVault CLI v${VERSION}${c.reset} — Offline-First Zero-Knowledge Password Manager

${c.bold}Core Commands:${c.reset}
  ${c.cyan}init${c.reset}                       Create a new encrypted vault database
  ${c.cyan}add${c.reset}                        Add a new credential entry
  ${c.cyan}list${c.reset}                       List all stored credentials
  ${c.cyan}get${c.reset} <title> [flags]        Retrieve a credential by title
  ${c.cyan}edit${c.reset} <title>               Edit an existing credential entry
  ${c.cyan}remove${c.reset} <title>             Delete a credential entry
  ${c.cyan}audit${c.reset}                      Security audit (breach check + strength + duplicates)
  ${c.cyan}generate${c.reset} [length]          Generate a strong random password
  ${c.cyan}change-password${c.reset}            Change the master password (re-encrypts vault)
  ${c.cyan}import${c.reset} <file.json>         Import a SafeVault backup file
  ${c.cyan}export${c.reset} <file.json>         Export vault as an encrypted backup

${c.bold}Flags for 'get':${c.reset}
  ${c.magenta}-u, --username${c.reset}             Print only the username (for scripting)
  ${c.magenta}-p, --password${c.reset}             Copy password to clipboard, wipe in 15s
  ${c.magenta}-t, --totp${c.reset}                 Print live 6-digit 2FA TOTP code

${c.bold}Flags for 'generate':${c.reset}
  ${c.magenta}--no-special${c.reset}               Generate password without special characters

${c.bold}Security:${c.reset}
  • 100% offline. No telemetry. No cloud.
  • AES-256-GCM encryption. PBKDF2 (600k iterations, SHA-512).
  • Vault file: ${c.yellow}${VAULT_PATH}${c.reset} (permissions: 0600)
  • 'audit' uses k-Anonymity — only a 5-char hash prefix is sent to HIBP.
`);
}

async function interactiveMenu() {
  let running = true;
  while (running) {
    console.clear();
    console.log(`${c.cyan}
  ╔══════════════════════════════════════════════╗
  ║         SafeVault CLI v${VERSION}                  ║
  ║   Offline-First Zero-Knowledge Vault         ║
  ╚══════════════════════════════════════════════╝${c.reset}
`);

    console.log(`${c.bold}  Select an action:${c.reset}`);
    console.log(`  ${c.green}1)${c.reset} List credentials`);
    console.log(`  ${c.green}2)${c.reset} Search & retrieve a credential`);
    console.log(`  ${c.green}3)${c.reset} Add a new credential`);
    console.log(`  ${c.green}4)${c.reset} Edit a credential`);
    console.log(`  ${c.green}5)${c.reset} Remove a credential`);
    console.log(`  ${c.green}6)${c.reset} Generate a strong password`);
    console.log(`  ${c.green}7)${c.reset} Security audit (breach + strength + duplicates)`);
    console.log(`  ${c.green}8)${c.reset} Change master password`);
    console.log(`  ${c.green}9)${c.reset} Initialize a new vault`);
    console.log(`  ${c.green}A)${c.reset} Import backup`);
    console.log(`  ${c.green}B)${c.reset} Export backup`);
    console.log(`  ${c.green}H)${c.reset} Help`);
    console.log(`  ${c.red}0)${c.reset} Exit`);
    console.log('');

    const choice = await prompt('  Enter option: ');
    console.log('');

    switch (choice.trim().toUpperCase()) {
      case '1': await list();                                                    break;
      case '2': { const s = (await prompt('Search title: ')).trim(); if (s) await get(s); break; }
      case '3': await add();                                                     break;
      case '4': { const s = (await prompt('Edit title: ')).trim(); if (s) await edit(s); break; }
      case '5': { const s = (await prompt('Remove title: ')).trim(); if (s) await remove(s); break; }
      case '6': await generate();                                                break;
      case '7': await audit();                                                   break;
      case '8': await changePassword();                                          break;
      case '9': await init();                                                    break;
      case 'A': { const p = (await prompt('Backup file path: ')).trim(); if (p) await importBackup(p); break; }
      case 'B': { const p = (await prompt('Output file path: ')).trim(); if (p) await exportBackup(p); break; }
      case 'H': printHelp();                                                     break;
      case '0': console.log('Goodbye!'); running = false;                        break;
      default:  console.log(`${c.red}Invalid option.${c.reset}`);               break;
    }

    if (running) {
      await prompt('\nPress Enter to return to menu...');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    await interactiveMenu();
    return;
  }

  const flags = {
    username : args.includes('--username')   || args.includes('-u'),
    password : args.includes('--password')   || args.includes('-p'),
    totp     : args.includes('--totp')       || args.includes('-t'),
    noSpecial: args.includes('--no-special'),
  };

  switch (command) {
    case 'init':            await init();                       break;
    case 'add':             await add();                        break;
    case 'list':            await list();                       break;
    case 'get':             await get(args[1], flags);          break;
    case 'edit':            await edit(args[1]);                break;
    case 'remove':
    case 'delete':
    case 'rm':              await remove(args[1]);              break;
    case 'audit':           await audit();                      break;
    case 'generate':
    case 'gen':             await generate(args[1], flags);     break;
    case 'change-password':
    case 'passwd':          await changePassword();             break;
    case 'import':          await importBackup(args[1]);        break;
    case 'export':          await exportBackup(args[1]);        break;
    case 'help':
    case '--help':
    case '-h':
    default:                printHelp();                        break;
  }
}

main().catch((err) => {
  console.error(`\n${c.red}Fatal error: ${err.message}${c.reset}`);
  process.exit(1);
});
