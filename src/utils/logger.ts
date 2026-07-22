/**
 * SafeVault Secure Logger
 * 
 * Sanitizes all log output to prevent leaking sensitive data.
 * Passwords, TOTP secrets, encryption keys, and master password hashes
 * are NEVER logged, even in development.
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /hash/i,
  /credential/i,
  /master/i,
  /passphrase/i,
  /salt/i,
  /iv/i,
];

const SENSITIVE_KEYS = new Set([
  'password',
  'masterPassword',
  'oldPassword',
  'newPassword',
  'confirmPassword',
  'totpSecret',
  'encryptedData',
  'verificationHash',
  'verificationSalt',
  'salt',
  'iv',
  'ciphertext',
  'encryptionKey',
  'key',
]);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[REDACTED-DEEP]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact base64-looking strings that might be secrets
    if (obj.length > 32 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
      return '[REDACTED-B64]';
    }
    return obj;
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => redact(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k) || SENSITIVE_PATTERNS.some(p => p.test(k))) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = redact(v, depth + 1);
    }
  }
  return result;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Detect dev mode: check for vite dev server or explicit flag
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(level: LogLevel, msg: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [SafeVault] [${level.toUpperCase()}] ${msg}`;
}

export const logger = {
  debug(msg: string, ...args: unknown[]) {
    if (!shouldLog('debug')) return;
    console.debug(formatMessage('debug', msg), ...args.map(a => redact(a)));
  },
  info(msg: string, ...args: unknown[]) {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', msg), ...args.map(a => redact(a)));
  },
  warn(msg: string, ...args: unknown[]) {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', msg), ...args.map(a => redact(a)));
  },
  error(msg: string, err?: unknown) {
    if (!shouldLog('error')) return;
    const safeErr = err instanceof Error
      ? { name: err.name, message: err.message }
      : redact(err);
    console.error(formatMessage('error', msg), safeErr);
  },
  /**
   * Capture an error for potential future error tracking.
   * No data leaves the device unless user opts in.
   */
  capture(msg: string, err?: unknown) {
    // Future: integrate with opt-in Sentry here.
    // For now, just log (with redaction).
    this.error(msg, err);
  },
};

// Global unhandled rejection handler (secure)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    logger.capture('Unhandled promise rejection', e.reason);
  });
  window.addEventListener('error', (e) => {
    logger.capture('Global error', { message: e.message, filename: e.filename });
  });
}
