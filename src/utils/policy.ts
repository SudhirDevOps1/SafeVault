/**
 * SafeVault Password Policy Enforcement
 * 
 * Enforces minimum security requirements for master passwords
 * to prevent weak/dictionary passwords.
 */

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Common weak passwords list (top 100) */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'password1', 'iloveyou', 'admin',
  'welcome', 'monkey', 'letmein', 'dragon', 'master',
  'sunshine', 'princess', 'football', 'charlie', 'shadow',
  'michael', 'login', 'starwars', 'passw0rd', 'whatever',
  'qwerty123', 'trustno1', 'hunter2', 'batman', 'access',
]);

export function validateMasterPassword(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length < 12) {
    warnings.push('Recommended: use 12+ characters for stronger security');
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common and easily guessable');
  }

  // Check for sequences
  if (/(0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|qwerty|asdf|zxcv)/i.test(password)) {
    errors.push('Password contains predictable sequences');
  }

  // Check for repeated characters (e.g., "aaaaaa")
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }

  // Check for keyboard patterns
  if (/^[a-z]+$/i.test(password) || /^[0-9]+$/.test(password)) {
    warnings.push('Mix uppercase, lowercase, numbers, and symbols for better security');
  }

  // Check entropy roughly
  const uniqueChars = new Set(password).size;
  if (uniqueChars < 4 && password.length >= 8) {
    errors.push('Password uses too few unique characters');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
