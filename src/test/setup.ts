import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// Delegate subtle crypto methods to Node.js native webcrypto
const subtle = {
  importKey: vi.fn((...args: any[]) => (webcrypto.subtle as any).importKey(...args)),
  deriveKey: vi.fn((...args: any[]) => (webcrypto.subtle as any).deriveKey(...args)),
  deriveBits: vi.fn((...args: any[]) => (webcrypto.subtle as any).deriveBits(...args)),
  encrypt: vi.fn((...args: any[]) => (webcrypto.subtle as any).encrypt(...args)),
  decrypt: vi.fn((...args: any[]) => (webcrypto.subtle as any).decrypt(...args)),
  sign: vi.fn((...args: any[]) => (webcrypto.subtle as any).sign(...args)),
  digest: vi.fn((...args: any[]) => (webcrypto.subtle as any).digest(...args)),
  exportKey: vi.fn((...args: any[]) => (webcrypto.subtle as any).exportKey(...args)),
};

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: <T extends ArrayBufferView>(arr: T): T => webcrypto.getRandomValues(arr as any) as T,
    subtle,
    randomUUID: () => webcrypto.randomUUID(),
  },
  writable: true,
  configurable: true,
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
