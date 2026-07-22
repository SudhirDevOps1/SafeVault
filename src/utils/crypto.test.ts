import { describe, it, expect } from 'vitest';
import {
  generateRandomBytes,
  bufferToBase64,
  base64ToBuffer,
  generateSalt,
  evaluatePasswordStrength,
  constantTimeCompare,
  generateId,
} from '../utils/crypto';

describe('Crypto Utilities', () => {
  describe('generateRandomBytes', () => {
    it('should generate bytes of correct length', () => {
      expect(generateRandomBytes(16)).toHaveLength(16);
      expect(generateRandomBytes(32)).toHaveLength(32);
    });

    it('should generate different values each time', () => {
      const a = generateRandomBytes(16);
      const b = generateRandomBytes(16);
      // Extremely unlikely to be equal
      expect(a).not.toEqual(b);
    });
  });

  describe('Base64 conversion', () => {
    it('should round-trip correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
      const b64 = bufferToBase64(original);
      const back = base64ToBuffer(b64);
      expect(Array.from(new Uint8Array(back))).toEqual(Array.from(original));
    });

    it('should handle empty input', () => {
      const b64 = bufferToBase64(new Uint8Array(0));
      expect(b64).toBe('');
      expect(base64ToBuffer('')).toHaveLength(0);
    });
  });

  describe('generateSalt', () => {
    it('should return a non-empty base64 string', () => {
      const salt = generateSalt();
      expect(salt.length).toBeGreaterThan(0);
      // 16 bytes -> 24 chars in base64
      expect(salt.length).toBe(24);
    });
  });

  describe('evaluatePasswordStrength', () => {
    it('should rate weak passwords low', () => {
      const weak = evaluatePasswordStrength('1234');
      expect(weak.score).toBeLessThanOrEqual(1);
      expect(weak.label).toBeOneOf(['Very Weak', 'Weak']);
    });

    it('should rate strong passwords high', () => {
      const strong = evaluatePasswordStrength('MyStr0ng!P@ssw0rd#2024');
      expect(strong.score).toBeGreaterThanOrEqual(3);
    });

    it('should return proper structure', () => {
      const result = evaluatePasswordStrength('test');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('color');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(4);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeCompare('abc', 'abc')).toBe(true);
      expect(constantTimeCompare('', '')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('abc', 'abd')).toBe(false);
      expect(constantTimeCompare('abc', 'abcd')).toBe(false);
    });
  });

  describe('generateId', () => {
    it('should return a 32-char hex string', () => {
      const id = generateId();
      expect(id).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });
});
