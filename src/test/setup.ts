import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock crypto.subtle for tests
const subtleMock = {
  importKey: vi.fn().mockResolvedValue({}),
  deriveKey: vi.fn().mockResolvedValue({}),
  deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
  decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('test')),
  sign: vi.fn().mockResolvedValue(new ArrayBuffer(20)),
};

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: subtleMock,
  },
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
