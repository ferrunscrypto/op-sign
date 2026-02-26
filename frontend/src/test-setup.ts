import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';
import { vi } from 'vitest';

// Polyfill crypto.subtle for jsdom (not available by default)
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true,
    });
}

// Suppress console.warn in tests unless explicitly expected
const originalWarn = console.warn;
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    // Allow through warnings that are expected/useful; suppress noise
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('[OP-Sign]')) return;
    originalWarn(...args);
});
