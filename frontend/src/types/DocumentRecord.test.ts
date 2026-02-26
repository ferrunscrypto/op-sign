import { describe, it, expect } from 'vitest';
import {
    DocumentRecord,
    isDocumentFound,
    signerToHex,
    truncateSigner,
} from './DocumentRecord';

// ─────────────────────────────────────────────────────────────────────────────
// isDocumentFound
// ─────────────────────────────────────────────────────────────────────────────

describe('isDocumentFound', () => {
    it('returns false when signer is 0n (not registered)', () => {
        const record: DocumentRecord = { signer: 0n, blockHeight: 0n, revoked: false };
        expect(isDocumentFound(record)).toBe(false);
    });

    it('returns true when signer is non-zero', () => {
        const record: DocumentRecord = {
            signer: 0xdeadbeefn,
            blockHeight: 100n,
            revoked: false,
        };
        expect(isDocumentFound(record)).toBe(true);
    });

    it('returns true for revoked document (revoked but registered)', () => {
        const record: DocumentRecord = {
            signer: 0xaabbccn,
            blockHeight: 42n,
            revoked: true,
        };
        expect(isDocumentFound(record)).toBe(true);
    });

    it('zero signer with high block height is still not found', () => {
        const record: DocumentRecord = {
            signer: 0n,
            blockHeight: 999999n,
            revoked: false,
        };
        expect(isDocumentFound(record)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// signerToHex
// ─────────────────────────────────────────────────────────────────────────────

describe('signerToHex', () => {
    it('returns 0x + 64 lowercase hex chars', () => {
        const hex = signerToHex(0n);
        expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('pads small values to 64 chars', () => {
        expect(signerToHex(1n)).toBe('0x' + '0'.repeat(63) + '1');
    });

    it('round-trips a known address', () => {
        const raw = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        const bn = BigInt('0x' + raw);
        expect(signerToHex(bn)).toBe('0x' + raw);
    });

    it('produces lowercase output', () => {
        const bn = BigInt('0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890');
        expect(signerToHex(bn)).toBe(signerToHex(bn).toLowerCase());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// truncateSigner
// ─────────────────────────────────────────────────────────────────────────────

describe('truncateSigner', () => {
    const knownSigner = BigInt(
        '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    );

    it('contains an ellipsis', () => {
        const result = truncateSigner(knownSigner);
        expect(result).toContain('…');
    });

    it('starts with 0x', () => {
        const result = truncateSigner(knownSigner);
        expect(result.startsWith('0x')).toBe(true);
    });

    it('is shorter than full 66-char hex representation', () => {
        const result = truncateSigner(knownSigner);
        expect(result.length).toBeLessThan(66);
    });

    it('default: prefix is 10 hex chars (after 0x)', () => {
        const result = truncateSigner(knownSigner);
        const full = signerToHex(knownSigner);
        // result should start with 0x + first 10 chars
        expect(result.startsWith(full.slice(0, 12))).toBe(true); // 0x + 10
    });

    it('custom prefixLen and suffixLen are applied', () => {
        const result = truncateSigner(knownSigner, 4, 4);
        const full = signerToHex(knownSigner);
        expect(result).toBe(full.slice(0, 6) + '…' + full.slice(-4)); // 0x + 4 prefix
    });

    it('zero signer truncation', () => {
        const result = truncateSigner(0n);
        expect(result).toContain('0');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DocumentRecord type shape
// ─────────────────────────────────────────────────────────────────────────────

describe('DocumentRecord interface', () => {
    it('can be constructed with all fields', () => {
        const record: DocumentRecord = {
            signer: 0xabcdn,
            blockHeight: 800000n,
            revoked: false,
        };
        expect(record.signer).toBe(0xabcdn);
        expect(record.blockHeight).toBe(800000n);
        expect(record.revoked).toBe(false);
    });

    it('revoked flag is independent of signer value', () => {
        const active: DocumentRecord = { signer: 0x1n, blockHeight: 1n, revoked: false };
        const revoked: DocumentRecord = { signer: 0x1n, blockHeight: 1n, revoked: true };
        expect(active.revoked).toBe(false);
        expect(revoked.revoked).toBe(true);
    });
});
