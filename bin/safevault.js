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

  const newCredential = {
    id: crypto.randomBytes(16).toString('hex'),
    title,
    username,
    password: credPassword,
    url,
    notes,
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

async function get(title) {
  if (!title) {
    console.log('Usage: safevault get <title>');
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

    const match = credentials.find(c => c.title.toLowerCase() === title.toLowerCase());
    if (!match) {
      console.log(`No credential found matching: ${title}`);
      return;
    }

    console.log('\nCredential details:');
    console.log('--------------------------------------------------');
    console.log(`Title:    ${match.title}`);
    console.log(`Username: ${match.username}`);
    console.log(`URL:      ${match.url || 'N/A'}`);
    console.log(`Notes:    ${match.notes || 'N/A'}`);
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
  const [,, command, arg] = process.argv;

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
    case 'get':
      await get(arg);
      break;
    case 'import':
      await importBackup(arg);
      break;
    case 'export':
      await exportBackup(arg);
      break;
    default:
      console.log(`
SafeVault CLI Tool v1.1.0

Commands:
  init                     Initialize a new vault database
  add                      Add a new credential entry
  list                     List all stored credential titles
  get <title>              Retrieve credential details and copy password
  import <file.json>       Import a SafeVault GUI backup file
  export <file.json>       Export a SafeVault GUI-compatible backup file
      `);
      break;
  }
}

main();
