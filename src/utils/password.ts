/**
 * SafeVault Secure Password Generator
 * 
 * Uses crypto.getRandomValues() for cryptographically secure randomness.
 */

import type { PasswordGeneratorOptions } from '@/types';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

const AMBIGUOUS_CHARS = 'O0Il1|';

export function generatePassword(options: PasswordGeneratorOptions): string {
  let charset = '';
  const required: string[] = [];

  if (options.includeUppercase) {
    let chars = UPPERCASE;
    if (options.excludeAmbiguous) {
      chars = chars.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }
    charset += chars;
    required.push(chars);
  }

  if (options.includeLowercase) {
    let chars = LOWERCASE;
    if (options.excludeAmbiguous) {
      chars = chars.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }
    charset += chars;
    required.push(chars);
  }

  if (options.includeNumbers) {
    let chars = NUMBERS;
    if (options.excludeAmbiguous) {
      chars = chars.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }
    charset += chars;
    required.push(chars);
  }

  if (options.includeSymbols) {
    let chars = SYMBOLS;
    if (options.excludeAmbiguous) {
      chars = chars.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }
    charset += chars;
    required.push(chars);
  }

  if (charset.length === 0) {
    charset = LOWERCASE + NUMBERS;
    required.push(LOWERCASE, NUMBERS);
  }

  const length = Math.max(options.length, 4);
  
  // Generate password ensuring at least one character from each required set
  let password: string[] = [];
  
  // First, pick one from each required character set
  for (const set of required) {
    const randomIndex = secureRandomInt(set.length);
    password.push(set[randomIndex]);
  }

  // Fill remaining with random chars from full charset
  for (let i = password.length; i < length; i++) {
    const randomIndex = secureRandomInt(charset.length);
    password.push(charset[randomIndex]);
  }

  // Shuffle the password to avoid predictable positions
  password = secureShuffleArray(password);

  return password.join('');
}

/** Get a cryptographically secure random integer in [0, max) */
function secureRandomInt(max: number): number {
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return randomBuffer[0] % max;
}

/** Cryptographically secure Fisher-Yates shuffle */
function secureShuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeAmbiguous: false,
};
