import { describe, it, expect } from 'vitest';
import { logger } from '../utils/logger';

describe('Secure Logger', () => {
  it('should redact sensitive keys', () => {
    // Capture console output
    const logs: unknown[] = [];
    const originalLog = console.error;
    console.error = (...args: unknown[]) => logs.push(args);

    logger.error('Test message', { password: 'secret123', username: 'john' });

    console.error = originalLog;

    const output = JSON.stringify(logs);
    expect(output).not.toContain('secret123');
    expect(output).toContain('[REDACTED]');
  });

  it('should export all required methods', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.capture).toBe('function');
  });

  it('should not throw on null/undefined', () => {
    expect(() => logger.error('Test', null)).not.toThrow();
    expect(() => logger.error('Test', undefined)).not.toThrow();
  });
});
