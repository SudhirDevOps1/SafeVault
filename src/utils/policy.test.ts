import { describe, it, expect } from 'vitest';
import { validateMasterPassword } from '../utils/policy';

describe('Password Policy', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validateMasterPassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('8 characters'))).toBe(true);
  });

  it('should reject common passwords', () => {
    const result = validateMasterPassword('password');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('too common'))).toBe(true);
  });

  it('should reject sequential patterns', () => {
    const result = validateMasterPassword('abcd1234');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sequence'))).toBe(true);
  });

  it('should reject repeated characters', () => {
    const result = validateMasterPassword('aaaaaaaaa');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('repeated'))).toBe(true);
  });

  it('should accept strong passwords', () => {
    const result = validateMasterPassword('MyStr0ng!Pass#2024');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn for passwords under 12 chars', () => {
    const result = validateMasterPassword('Short1Pass!');
    expect(result.warnings.some(w => w.includes('12+'))).toBe(true);
  });

  it('should reject low-entropy passwords', () => {
    const result = validateMasterPassword('aaaaaaaaab');
    expect(result.valid).toBe(false);
  });
});
