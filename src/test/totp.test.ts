import { describe, it, expect } from 'vitest';
import { isValidTOTPSecret, generateTOTP } from '../utils/totp';

describe('TOTP Authenticator Engine', () => {
  it('should validate secret keys correctly', () => {
    // 16+ chars base32 secrets are valid
    expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidTOTPSecret('4S2NYK3SM67LMN2U')).toBe(true);
    // Invalid characters or short keys
    expect(isValidTOTPSecret('SHORT')).toBe(false);
    expect(isValidTOTPSecret('INVALID_CHAR_123!')).toBe(false);
  });

  it('should generate numeric 6-digit TOTP tokens', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const token = await generateTOTP(secret);
    
    expect(token).toBeTypeOf('string');
    expect(token).toHaveLength(6);
    expect(Number(token)).not.toBeNaN();
  });
});
