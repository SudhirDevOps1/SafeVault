import { describe, it, expect } from 'vitest';
import {
  generatePassword,
  DEFAULT_PASSWORD_OPTIONS,
} from '../utils/password';

describe('Password Generator', () => {
  it('should generate password of requested length', () => {
    const pwd = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 20 });
    expect(pwd).toHaveLength(20);
  });

  it('should enforce minimum length of 4', () => {
    const pwd = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 2 });
    expect(pwd.length).toBeGreaterThanOrEqual(4);
  });

  it('should include uppercase when requested', () => {
    const pwd = generatePassword({
      length: 50,
      includeUppercase: true,
      includeLowercase: false,
      includeNumbers: false,
      includeSymbols: false,
      excludeAmbiguous: false,
    });
    expect(/[A-Z]/.test(pwd)).toBe(true);
  });

  it('should include lowercase when requested', () => {
    const pwd = generatePassword({
      length: 50,
      includeUppercase: false,
      includeLowercase: true,
      includeNumbers: false,
      includeSymbols: false,
      excludeAmbiguous: false,
    });
    expect(/[a-z]/.test(pwd)).toBe(true);
  });

  it('should include numbers when requested', () => {
    const pwd = generatePassword({
      length: 50,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: true,
      includeSymbols: false,
      excludeAmbiguous: false,
    });
    expect(/[0-9]/.test(pwd)).toBe(true);
  });

  it('should include symbols when requested', () => {
    const pwd = generatePassword({
      length: 50,
      includeUppercase: false,
      includeLowercase: true,
      includeNumbers: false,
      includeSymbols: true,
      excludeAmbiguous: false,
    });
    expect(/[^a-zA-Z0-9]/.test(pwd)).toBe(true);
  });

  it('should exclude ambiguous characters when requested', () => {
    const pwd = generatePassword({
      length: 100,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeAmbiguous: true,
    });
    expect(/[OIl1|]/.test(pwd)).toBe(false);
    expect(/0/.test(pwd)).toBe(false);
  });

  it('should generate different passwords each time', () => {
    const pwds = new Set(
      Array.from({ length: 10 }, () => generatePassword(DEFAULT_PASSWORD_OPTIONS))
    );
    // Very unlikely to generate duplicates
    expect(pwds.size).toBe(10);
  });
});
