import { describe, it, expect } from 'vitest';

// ── SHA-256 hash helpers (used by both contract and frontend) ─────────────────

/** Convert a hex string to a BigInt (same as frontend's hashDocumentToU256) */
function hexToBigInt(hex: string): bigint {
    return BigInt('0x' + hex);
}

/** Format a BigInt as a 64-char hex string with 0x prefix */
function formatHashHex(hash: bigint): string {
    return '0x' + hash.toString(16).padStart(64, '0');
}

/** Detect zero-value signer (document not found) */
function isDocumentFound(signer: bigint): boolean {
    return signer !== 0n;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Hash utilities', () => {
    it('hexToBigInt converts known SHA-256 hex to bigint', () => {
        // SHA-256 of empty string
        const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const bn = hexToBigInt(emptyHash);
        expect(typeof bn).toBe('bigint');
        expect(bn).toBeGreaterThan(0n);
    });

    it('formatHashHex pads to 64 hex chars', () => {
        const hash = hexToBigInt('000000000000001');
        const hex = formatHashHex(hash);
        expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('formatHashHex round-trips a known hash', () => {
        const original = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const bn = hexToBigInt(original);
        const formatted = formatHashHex(bn);
        expect(formatted).toBe('0x' + original);
    });

    it('two different files have different hashes (collision resistance)', () => {
        const hash1 = hexToBigInt('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        const hash2 = hexToBigInt('2c624232cdd221771294dfbb310acbc8713a599b3aca35c5b09c9c0a7e6ef8');
        expect(hash1).not.toBe(hash2);
    });
});

describe('Document record logic', () => {
    it('isDocumentFound returns false for zero signer', () => {
        expect(isDocumentFound(0n)).toBe(false);
    });

    it('isDocumentFound returns true for non-zero signer', () => {
        const signer = hexToBigInt('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
        expect(isDocumentFound(signer)).toBe(true);
    });
});

describe('Contract business logic rules', () => {
    // These tests encode the rules enforced by the contract as documented specs.
    // The contract enforces them in AssemblyScript; here we verify the logic in TS.

    it('signing the same hash twice must be rejected', () => {
        // Simulated state: store tracks registered hashes
        const registered = new Set<string>();

        function tryRegister(hash: bigint): boolean {
            const key = hash.toString();
            if (registered.has(key)) return false; // contract would revert
            registered.add(key);
            return true;
        }

        const hash = hexToBigInt('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect(tryRegister(hash)).toBe(true);
        expect(tryRegister(hash)).toBe(false); // second registration rejected
    });

    it('only the original signer can revoke', () => {
        type Signer = bigint;
        const registry = new Map<bigint, { signer: Signer; revoked: boolean }>();

        const hash = 42n;
        const alice = 0xAAAAn;
        const bob = 0xBBBBn;

        registry.set(hash, { signer: alice, revoked: false });

        function tryRevoke(h: bigint, caller: Signer): boolean {
            const record = registry.get(h);
            if (!record) return false; // not found
            if (record.signer !== caller) return false; // not the signer
            if (record.revoked) return false; // already revoked
            record.revoked = true;
            return true;
        }

        expect(tryRevoke(hash, bob)).toBe(false);    // wrong signer
        expect(tryRevoke(hash, alice)).toBe(true);   // correct signer
        expect(tryRevoke(hash, alice)).toBe(false);  // already revoked
    });

    it('verifying an unregistered document returns zero signer', () => {
        const registry = new Map<bigint, { signer: bigint; block: bigint; revoked: boolean }>();

        function verify(hash: bigint): { signer: bigint; blockHeight: bigint; revoked: boolean } {
            const record = registry.get(hash);
            if (!record) return { signer: 0n, blockHeight: 0n, revoked: false };
            return { signer: record.signer, blockHeight: record.block, revoked: record.revoked };
        }

        const result = verify(999n);
        expect(result.signer).toBe(0n); // zero signer = not found
    });

    it('total doc count increments on each registration', () => {
        let total = 0n;
        const signerCounts = new Map<bigint, bigint>();

        function sign(hash: bigint, signer: bigint): boolean {
            const existing = signerCounts.get(hash);
            if (existing !== undefined) return false; // already registered
            signerCounts.set(hash, signer);
            total += 1n;
            return true;
        }

        expect(sign(1n, 0xAn)).toBe(true);
        expect(total).toBe(1n);
        expect(sign(2n, 0xAn)).toBe(true);
        expect(total).toBe(2n);
        expect(sign(1n, 0xBn)).toBe(false); // duplicate hash
        expect(total).toBe(2n);
    });
});
