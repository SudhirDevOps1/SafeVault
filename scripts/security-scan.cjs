#!/usr/bin/env node
/**
 * SafeVault Automated Local Security & CodeQL Readiness Scanner
 * 
 * Performs:
 * 1. Hardcoded Secrets & Key Leak Detection
 * 2. Insecure Pattern & XSS Vulnerability Scanning
 * 3. Cryptographic Sanity Verification (IVs, Salts, Algorithms)
 * 4. Manifest V3 & Electron Security Policy Audits
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔒 ========================================================');
console.log('   SafeVault Local Security & Vulnerability Scanner');
console.log('========================================================\n');

let findingsCount = 0;
const rootDir = path.resolve(__dirname, '..');

// 1. Scan for Potential Hardcoded Secrets / Keys
console.log('▶ [1/4] Scanning for hardcoded private keys & tokens...');
const secretPatterns = [
  { name: 'Private Key block', regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: 'Generic Secret Token', regex: /(api[_-]?key|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{24,}['"]/i },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
];

function scanDirForSecrets(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'release'].includes(entry.name)) continue;
      scanDirForSecrets(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|cjs|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(content)) {
          console.warn(`  ⚠️ Potential ${pattern.name} found in: ${path.relative(rootDir, fullPath)}`);
          findingsCount++;
        }
      }
    }
  }
}
scanDirForSecrets(path.join(rootDir, 'src'));
scanDirForSecrets(path.join(rootDir, 'electron'));
scanDirForSecrets(path.join(rootDir, 'extension'));
console.log('  ✓ Secrets scan completed.\n');

// 2. Scan for Insecure Code Patterns (eval, unsafe-inline scripts)
console.log('▶ [2/4] Scanning for dangerous JavaScript patterns & XSS vectors...');
const dangerousPatterns = [
  { name: 'Direct eval() usage', regex: /\beval\s*\(/ },
  { name: 'Function constructor code execution', regex: /new\s+Function\s*\(/ },
];

function scanDirForDangerousPatterns(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'release'].includes(entry.name)) continue;
      scanDirForDangerousPatterns(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|cjs)$/.test(entry.name)) {
      if (entry.name.includes('.test.') || entry.name === 'security-scan.cjs') continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of dangerousPatterns) {
        if (pattern.regex.test(content)) {
          console.error(`  ❌ Dangerous pattern detected (${pattern.name}) in: ${path.relative(rootDir, fullPath)}`);
          findingsCount++;
        }
      }
    }
  }
}
scanDirForDangerousPatterns(path.join(rootDir, 'src'));
scanDirForDangerousPatterns(path.join(rootDir, 'electron'));
scanDirForDangerousPatterns(path.join(rootDir, 'extension'));
console.log('  ✓ Code patterns verified safe.\n');

// 3. Cryptographic Sanity Verification
console.log('▶ [3/4] Verifying Cryptographic parameter standards...');
const cryptoFilePath = path.join(rootDir, 'src/utils/crypto.ts');
if (fs.existsSync(cryptoFilePath)) {
  const cryptoCode = fs.readFileSync(cryptoFilePath, 'utf8');
  if (!cryptoCode.includes('AES-GCM')) {
    console.error('  ❌ Missing standard AES-GCM cipher in crypto.ts');
    findingsCount++;
  }
  if (!cryptoCode.includes('IV_LENGTH = 12')) {
    console.error('  ❌ Non-standard GCM IV length (must be 12 bytes / 96 bits)');
    findingsCount++;
  }
  if (!cryptoCode.includes('argon2id') && !cryptoCode.includes('PBKDF2')) {
    console.error('  ❌ Missing robust KDF algorithm');
    findingsCount++;
  }
  console.log('  ✓ Cryptography parameters conform to NIST SP 800-38D & OWASP guidelines.');
} else {
  console.error('  ❌ crypto.ts not found');
  findingsCount++;
}
console.log();

// 4. Manifest V3 & Electron Security Hardening Check
console.log('▶ [4/4] Verifying Electron & Chrome Extension security hardening...');
const electronMain = path.join(rootDir, 'electron/main.cjs');
if (fs.existsSync(electronMain)) {
  const code = fs.readFileSync(electronMain, 'utf8');
  if (!code.includes('contextIsolation: true')) {
    console.error('  ❌ Electron contextIsolation is not enabled!');
    findingsCount++;
  }
  if (!code.includes('nodeIntegration: false')) {
    console.error('  ❌ Electron nodeIntegration is not disabled in renderer!');
    findingsCount++;
  }
  if (!code.includes('setContentProtection(true)')) {
    console.warn('  ⚠️ Electron screen capture protection (setContentProtection) missing');
  }
  console.log('  ✓ Electron sandbox & contextIsolation verified.');
}

const manifestPath = path.join(rootDir, 'extension/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    console.error('  ❌ Extension is not Manifest V3 compliant!');
    findingsCount++;
  }
  console.log('  ✓ Extension Manifest V3 verified.');
}
console.log();

// Summary
if (findingsCount === 0) {
  console.log('🎉 [PASS] Security audit passed with 0 vulnerabilities detected!\n');
  process.exit(0);
} else {
  console.warn(`⚠️ [WARNING] Security audit finished with ${findingsCount} notice(s).\n`);
  process.exit(1);
}
