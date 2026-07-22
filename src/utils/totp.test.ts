import { describe, it, expect } from 'vitest';
import { isValidTOTPSecret, getTOTPPeriod } from '../utils/totp';

describe('TOTP Utilities', () => {
  describe('isValidTOTPSecret', () => {
    it('should accept valid Base32 secrets', () => {
      expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP')).toBe(true);
      expect(isValidTOTPSecret('ABCDEFGHIJKLMNOP')).toBe(true);
    });

    it('should accept secrets with spaces and lowercase', () => {
      expect(isValidTOTPSecret('jbsw y3dp ehpk 3pxp')).toBe(true);
    });

    it('should reject invalid secrets', () => {
      expect(isValidTOTPSecret('')).toBe(false);
      expect(isValidTOTPSecret('SHORT')).toBe(false);
      expect(isValidTOTPSecret('1234567890123456')).toBe(false); // Contains 1, 8, 9, 0 which aren't valid base32
    });
  });

  describe('getTOTPPeriod', () => {
    it('should return 30 seconds', () => {
      expect(getTOTPPeriod()).toBe(30);
    });
  });
});
