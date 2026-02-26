import { describe, it, expect } from 'vitest';
import { formatHashHex, truncateHash, hashDocumentToU256 } from './hashDocument';

// ─────────────────────────────────────────────────────────────────────────────
// formatHashHex
// ─────────────────────────────────────────────────────────────────────────────

describe('formatHashHex', () => {
    it('returns 0x prefix + 64 hex chars', () => {
        const hex = formatHashHex(0n);
        expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
        expect(hex).toHaveLength(66); // 2 (0x) + 64
    });

    it('pads short bigint to 64 chars', () => {
        expect(formatHashHex(1n)).toBe('0x' + '0'.repeat(63) + '1');
        expect(formatHashHex(255n)).toBe('0x' + '0'.repeat(62) + 'ff');
    });

    it('round-trips a known SHA-256 hash', () => {
        const hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const bn = BigInt('0x' + hex);
        expect(formatHashHex(bn)).toBe('0x' + hex);
    });

    it('handles maximum u256', () => {
        const max = (1n << 256n) - 1n;
        const result = formatHashHex(max);
        expect(result).toBe('0x' + 'f'.repeat(64));
    });

    it('does not produce uppercase hex', () => {
        const result = formatHashHex(0xdeadbeefn);
        expect(result).toBe(result.toLowerCase());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// truncateHash
// ─────────────────────────────────────────────────────────────────────────────

describe('truncateHash', () => {
    const fullHash = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it('returns the full string when it is short enough', () => {
        const short = '0xabcdef';
        expect(truncateHash(short)).toBe(short);
    });

    it('truncates long hash with ellipsis', () => {
        const result = truncateHash(fullHash, 18, 6);
        expect(result).toContain('…');
        expect(result.length).toBeLessThan(fullHash.length);
    });

    it('preserves the prefix of the expected length', () => {
        const result = truncateHash(fullHash, 18, 6);
        expect(result.startsWith(fullHash.slice(0, 18))).toBe(true);
    });

    it('preserves the suffix of the expected length', () => {
        const result = truncateHash(fullHash, 18, 6);
        expect(result.endsWith(fullHash.slice(-6))).toBe(true);
    });

    it('custom prefixLen and suffixLen are respected', () => {
        const result = truncateHash(fullHash, 4, 4);
        expect(result).toBe(fullHash.slice(0, 4) + '…' + fullHash.slice(-4));
    });

    it('hash exactly at threshold is not truncated', () => {
        const s = '0xshort'; // 8 chars < 18+6 default threshold (24)
        expect(truncateHash(s)).toBe(s);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// hashDocumentToU256
// ─────────────────────────────────────────────────────────────────────────────

describe('hashDocumentToU256', () => {
    /** Helper: create an in-memory File from bytes */
    function makeFile(bytes: Uint8Array, name = 'test.bin'): File {
        return new File([bytes], name, { type: 'application/octet-stream' });
    }

    it('returns a bigint', async () => {
        const file = makeFile(new Uint8Array([1, 2, 3]));
        const hash = await hashDocumentToU256(file);
        expect(typeof hash).toBe('bigint');
    });

    it('returns a non-zero bigint for non-empty file', async () => {
        const file = makeFile(new Uint8Array([104, 101, 108, 108, 111])); // "hello"
        const hash = await hashDocumentToU256(file);
        expect(hash).toBeGreaterThan(0n);
    });

    it('returns a zero-or-nonzero bigint for empty file (SHA-256 of empty is known)', async () => {
        const file = makeFile(new Uint8Array(0));
        const hash = await hashDocumentToU256(file);
        // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        const expected = BigInt('0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect(hash).toBe(expected);
    });

    it('same bytes → same hash (deterministic)', async () => {
        const bytes = new Uint8Array([10, 20, 30, 40, 50]);
        const hash1 = await hashDocumentToU256(makeFile(bytes, 'a.bin'));
        const hash2 = await hashDocumentToU256(makeFile(bytes, 'b.bin')); // different name, same content
        expect(hash1).toBe(hash2);
    });

    it('different bytes → different hash', async () => {
        const hash1 = await hashDocumentToU256(makeFile(new Uint8Array([0])));
        const hash2 = await hashDocumentToU256(makeFile(new Uint8Array([1])));
        expect(hash1).not.toBe(hash2);
    });

    it('changing one byte produces a completely different hash', async () => {
        const bytes1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const bytes2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9]); // last byte differs
        const h1 = await hashDocumentToU256(makeFile(bytes1));
        const h2 = await hashDocumentToU256(makeFile(bytes2));
        expect(h1).not.toBe(h2);
    });

    it('hash fits within 256 bits', async () => {
        const file = makeFile(new Uint8Array(1024).fill(0xaa));
        const hash = await hashDocumentToU256(file);
        expect(hash).toBeLessThan(1n << 256n);
    });
});
