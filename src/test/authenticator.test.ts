import { describe, it, expect } from 'vitest';
import {
  generateTOTP,
  isValidTOTPSecret,
  parseOtpAuthUri,
  base32Decode,
  getTOTPTimeRemaining
} from '../utils/totp';

describe('Proton-Grade Authenticator & TOTP Engine', () => {
  // Standard test vectors
  const RFC_SECRET = 'JBSWY3DPEHPK3PXP'; // "Hello!\xde\xad\xbe\xef" Base32

  it('validates Base32 secrets correctly', () => {
    expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidTOTPSecret('jbswy3dpehpk3pxp')).toBe(true);
    expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP==')).toBe(true);
    expect(isValidTOTPSecret('SHORT')).toBe(false);
    expect(isValidTOTPSecret('INVALID1890')).toBe(false); // 1, 8, 9, 0 are not Base32
    expect(isValidTOTPSecret('')).toBe(false);
  });

  it('decodes Base32 strings into correct byte arrays', () => {
    const bytes = base32Decode('JBSWY3DPEHPK3PXP');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(10);
  });

  it('generates standard 6-digit SHA-1 TOTP token', async () => {
    const token = await generateTOTP(RFC_SECRET);
    expect(token).toMatch(/^\d{6}$/);
    expect(token.length).toBe(6);
  });

  it('generates 8-digit SHA-256 TOTP token', async () => {
    const token = await generateTOTP(RFC_SECRET, {
      algorithm: 'SHA-256',
      digits: 8,
      period: 30
    });
    expect(token).toMatch(/^\d{8}$/);
    expect(token.length).toBe(8);
  });

  it('generates 6-digit SHA-512 TOTP token', async () => {
    const token = await generateTOTP(RFC_SECRET, {
      algorithm: 'SHA-512',
      digits: 6,
      period: 60
    });
    expect(token).toMatch(/^\d{6}$/);
    expect(token.length).toBe(6);
  });

  it('calculates 5-letter alphanumeric Steam Guard code', async () => {
    const steamCode = await generateTOTP(RFC_SECRET, {
      isSteam: true
    });
    expect(steamCode.length).toBe(5);
    // Steam chars: 23456789BCDFGHJKMNPQRTVWXY
    expect(/^[2-9BCDFGHJKMNPQRTVWXY]{5}$/.test(steamCode)).toBe(true);
  });

  it('parses standard otpauth://totp/ URIs correctly', () => {
    const uri = 'otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google&algorithm=SHA256&digits=8&period=30';
    const parsed = parseOtpAuthUri(uri);

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('totp');
    expect(parsed?.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed?.issuer).toBe('Google');
    expect(parsed?.algorithm).toBe('SHA-256');
    expect(parsed?.digits).toBe(8);
    expect(parsed?.period).toBe(30);
  });

  it('handles invalid URIs gracefully', () => {
    expect(parseOtpAuthUri('')).toBeNull();
    expect(parseOtpAuthUri('https://example.com')).toBeNull();
    expect(parseOtpAuthUri('otpauth://invalid/test')).toBeNull();
    expect(parseOtpAuthUri('otpauth://totp/Test?no_secret=1')).toBeNull();
  });

  it('returns valid time remaining within period bounds', () => {
    const remaining30 = getTOTPTimeRemaining(30);
    expect(remaining30).toBeGreaterThanOrEqual(1);
    expect(remaining30).toBeLessThanOrEqual(30);

    const remaining60 = getTOTPTimeRemaining(60);
    expect(remaining60).toBeGreaterThanOrEqual(1);
    expect(remaining60).toBeLessThanOrEqual(60);
  });
});
