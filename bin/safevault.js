#!/usr/bin/env node

/**
 * SafeVault CLI Tool
 * 
 * Secure, zero-knowledge, offline-first command line credentials manager.
 * Fully compatible with SafeVault GUI desktop app backups.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');
const https = require('https');

const VAULT_PATH = path.join(os.homedir(), '.safevault.db');
const PBKDF2_ITERATIONS = 600000;

// Helper to ask user for input securely
function prompt(question, isPassword = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (isPassword) {
      // Mask password inputs
      const stdin = process.openStdin();
      process.stdin.on('data', char => {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.pause();
            break;
          default:
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(rl.line.length));
            break;
        }
      });
    }

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// OS Clipboard Helper
function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      execSync('clip', { input: text });
    } else if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text });
    } else {
      execSync('xclip -selection clipboard', { input: text });
    }
    return true;
  } catch {
    return false;
  }
}

// Cryptography Helpers
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
  const ciphertextBuffer = Buffer.concat([
    Buffer.from(encrypted, 'base64'),
    authTag
  ]);
  return {
    ciphertext: ciphertextBuffer.toString('base64'),
    iv: iv.toString('base64')
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

// Base32 Decoder for TOTP
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

// Dynamic TOTP generator helper
function generateTOTP(secret) {
  if (!secret) return '';
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
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
    const otp = code % 1000000;
    return otp.toString().padStart(6, '0');
  } catch {
    return 'ERROR';
  }
}

// HTTPS range request helper for k-Anonymity
function checkPwned(prefix) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.pwnedpasswords.com/range/${prefix}`, (res) => {
      if (res.statusCode !== 200) {
        resolve('');
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

// Main Commands
async function init() {
  if (fs.existsSync(VAULT_PATH)) {
    const confirm = await prompt('Vault already exists. Overwrite? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  const password = await prompt('Set Master Password: ', true);
  console.log('\n');
  if (password.length < 8) {
    console.log('Error: Password must be at least 8 characters long.');
    return;
  }

  const salt = crypto.randomBytes(16).toString('base64');
  const verificationSalt = crypto.randomBytes(16).toString('base64');
  const verificationHash = createVerificationHash(password, verificationSalt);

  const key = deriveKey(password, salt);
  const { ciphertext, iv } = encrypt(JSON.stringify([]), key);

  const vault = {
    salt,
    verificationSalt,
    verificationHash,
    encryptedData: ciphertext,
    iv,
    autoLockMinutes: 5
  };

  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2));
  console.log(`Vault initialized successfully at ${VAULT_PATH}`);
}

async function add() {
  if (!fs.existsSync(VAULT_PATH)) {
    console.log("No vault found. Run 'safevault init' to create one.");
    return;
  }

  const password = await prompt('Enter Master Password: ', true);
  console.log('\n');
  const vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));

  const verHash = createVerificationHash(password, vault.verificationSalt);
  if (verHash !== vault.verificationHash) {
    console.log('Error: Incorrect password.');
    return;
  }

  const key = deriveKey(password, vault.salt);
  let credentials = [];
  try {
    const decrypted = decrypt(vault.encryptedData, vault.iv, key);
    credentials = JSON.parse(decrypted);
  } catch {
    console.log('Error: Decryption failed.');
    return;
  }

  const title = await prompt('Title: ');
  const username = await prompt('Username: ');
  const credPassword = await prompt('Password: ');
  const url = await prompt('URL: ');
  const notes = await prompt('Notes: ');
  const totpSecret = await prompt('TOTP Secret (optional): ');

  const newCredential = {
    id: crypto.randomBytes(16).toString('hex'),
    title,
    username,
    password: credPassword,
    url,
    notes,
    totpSecret: totpSecret || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  credentials.push(newCredential);

  const { ciphertext, iv } = encrypt(JSON.stringify(credentials), key);
  vault.encryptedData = ciphertext;
  vault.iv = iv;

  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2));
  console.log('Credential added successfully!');
}

async function list() {
  if (!fs.existsSync(VAULT_PATH)) {
    console.log("No vault found. Run 'safevault init' to create one.");
    return;
  }

  const password = await prompt('Enter Master Password: ', true);
  console.log('\n');
  const vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));

  const verHash = createVerificationHash(password, vault.verificationSalt);
  if (verHash !== vault.verificationHash) {
    console.log('Error: Incorrect password.');
    return;
  }

  const key = deriveKey(password, vault.salt);
  try {
    const decrypted = decrypt(vault.encryptedData, vault.iv, key);
    const credentials = JSON.parse(decrypted);

    if (credentials.length === 0) {
      console.log('No credentials stored.');
      return;
    }

    console.log('\nStored Credentials:');
    console.log('--------------------------------------------------');
    credentials.forEach((c) => {
      console.log(`[${c.title}] - User: ${c.username || 'N/A'} - URL: ${c.url || 'N/A'}`);
    });
    console.log('--------------------------------------------------');
  } catch {
    console.log('Error: Decryption failed.');
  }
}

async function get(title, flags = {}) {
  if (!title) {
    console.log('Usage: safevault get <title> [options]');
    return;
  }

  if (!fs.existsSync(VAULT_PATH)) {
    console.log("No vault found. Run 'safevault init' to create one.");
    return;
  }

  const password = await prompt('Enter Master Password: ', true);
  console.log('\n');
  const vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));

  const verHash = createVerificationHash(password, vault.verificationSalt);
  if (verHash !== vault.verificationHash) {
    console.log('Error: Incorrect password.');
    return;
  }

  const key = deriveKey(password, vault.salt);
  try {
    const decrypted = decrypt(vault.encryptedData, vault.iv, key);
    const credentials = JSON.parse(decrypted);

    // Case-insensitive fuzzy search matching
    const matches = credentials.filter(c => c.title.toLowerCase().includes(title.toLowerCase()));

    if (matches.length === 0) {
      console.log(`No credential found matching: ${title}`);
      process.exit(0);
    }

    if (matches.length > 1) {
      console.log(`Multiple credentials found matching "${title}". Please be more specific:`);
      matches.forEach(m => console.log(`  * ${m.title} (${m.username || 'no username'})`));
      process.exit(0);
    }

    const match = matches[0];

    // Specific property outputs via flags
    if (flags.username) {
      console.log(match.username || '');
      process.exit(0);
    }

    if (flags.totp) {
      if (!match.totpSecret) {
        console.log('No TOTP secret configured for this entry.');
        process.exit(1);
      }
      const token = generateTOTP(match.totpSecret);
      console.log(token);
      process.exit(0);
    }

    if (flags.password) {
      if (copyToClipboard(match.password)) {
        console.log('Password copied to clipboard securely! Auto-clearing in 15 seconds...');
        setTimeout(() => {
          copyToClipboard('');
          process.exit(0);
        }, 15000);
      } else {
        console.log(match.password);
        process.exit(0);
      }
      return;
    }

    // Default detailed printout
    console.log('\nCredential details:');
    console.log('--------------------------------------------------');
    console.log(`Title:    ${match.title}`);
    console.log(`Username: ${match.username}`);
    console.log(`URL:      ${match.url || 'N/A'}`);
    console.log(`Notes:    ${match.notes || 'N/A'}`);
    if (match.totpSecret) {
      const code = generateTOTP(match.totpSecret);
      console.log(`2FA Code: ${code} (Updates every 30s)`);
    }
    console.log('--------------------------------------------------');

    if (copyToClipboard(match.password)) {
      console.log('Password copied to clipboard! Wiping in 15 seconds...');
      setTimeout(() => {
        copyToClipboard('');
        console.log('Clipboard wiped.');
        process.exit(0);
      }, 15000);
    } else {
      console.log(`Password: ${match.password}`);
      process.exit(0);
    }
  } catch {
    console.log('Error: Decryption failed.');
    process.exit(1);
  }
}

async function audit() {
  if (!fs.existsSync(VAULT_PATH)) {
    console.log("No vault found. Run 'safevault init' to create one.");
    return;
  }

  const password = await prompt('Enter Master Password: ', true);
  console.log('\n');
  const vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));

  const verHash = createVerificationHash(password, vault.verificationSalt);
  if (verHash !== vault.verificationHash) {
    console.log('Error: Incorrect password.');
    return;
  }

  const key = deriveKey(password, vault.salt);
  try {
    const decrypted = decrypt(vault.encryptedData, vault.iv, key);
    const credentials = JSON.parse(decrypted);

    if (credentials.length === 0) {
      console.log('No credentials to audit.');
      return;
    }

    console.log('Auditing passwords securely using k-Anonymity...');
    let breachesFound = 0;

    for (const c of credentials) {
      if (!c.password) continue;
      
      const sha1 = crypto.createHash('sha1').update(c.password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      try {
        const text = await checkPwned(prefix);
        const lines = text.split('\n');
        for (const line of lines) {
          const [lineSuffix, countStr] = line.split(':');
          if (lineSuffix.trim() === suffix) {
            const count = parseInt(countStr.trim(), 10);
            console.log(`\x1b[31m[BREACHED]\x1b[0m ${c.title} - Password appeared ${count.toLocaleString()} times in leaks!`);
            breachesFound++;
            break;
          }
        }
      } catch (err) {
        console.log(`Failed to audit ${c.title}: Network error.`);
      }
    }

    if (breachesFound === 0) {
      console.log('\x1b[32m[SAFE]\x1b[0m All passwords are secure! No leaks found.');
    } else {
      console.log(`\nAudit finished: Found ${breachesFound} breached password(s). Please update them immediately.`);
    }
  } catch (err) {
    console.log('Error: Decryption failed.');
  }
}

async function importBackup(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('Usage: safevault import <path-to-json-file>');
    return;
  }

  try {
    const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (backup.type !== 'safevault-backup') {
      console.log('Error: Invalid backup file format.');
      return;
    }

    fs.writeFileSync(VAULT_PATH, JSON.stringify(backup.data, null, 2));
    console.log(`Backup imported successfully to ${VAULT_PATH}`);
  } catch (err) {
    console.log('Failed to import backup:', err.message);
  }
}

async function exportBackup(filePath) {
  if (!filePath) {
    console.log('Usage: safevault export <output-path.json>');
    return;
  }

  if (!fs.existsSync(VAULT_PATH)) {
    console.log('No vault found to export.');
    return;
  }

  try {
    const vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
    const backup = {
      type: 'safevault-backup',
      version: 1,
      exportedAt: Date.now(),
      data: vault
    };

    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    console.log(`Vault database exported successfully to ${filePath}`);
  } catch (err) {
    console.log('Failed to export vault:', err.message);
  }
}

// Command router
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await init();
      break;
    case 'add':
      await add();
      break;
    case 'list':
      await list();
      break;
    case 'get': {
      const searchTitle = args[1];
      const flags = {
        username: args.includes('--username') || args.includes('-u'),
        password: args.includes('--password') || args.includes('-p'),
        totp: args.includes('--totp') || args.includes('-t'),
      };
      await get(searchTitle, flags);
      break;
    }
    case 'audit':
      await audit();
      break;
    case 'import':
      await importBackup(args[1]);
      break;
    case 'export':
      await exportBackup(args[1]);
      break;
    default:
      console.log(`
SafeVault CLI Tool v1.1.0

Commands:
  init                     Initialize a new vault database
  add                      Add a new credential entry
  list                     List all stored credential titles
  get <title> [options]    Retrieve credential details and copy password
  audit                    Run offline security breach checks using k-Anonymity

Options for 'get':
  -u, --username           Directly print only the username
  -p, --password           Directly copy the password without displaying info
  -t, --totp               Generate and print only the 2FA TOTP token
  
Backups:
  import <file.json>       Import a SafeVault GUI backup file
  export <file.json>       Export a SafeVault GUI-compatible backup file
      `);
      break;
  }
}

main();
