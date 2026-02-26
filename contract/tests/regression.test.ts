/**
 * regression.test.ts
 *
 * Edge-case and failure-mode tests for OpSign.
 * Each test encodes a specific invariant that MUST hold in production;
 * if any of these break after a contract change, something has regressed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    OpSignSimulator,
    ALICE,
    BOB,
    EMPTY_FILE_HASH,
    MAX_U256,
} from './helpers/OpSignSimulator';

let sim: OpSignSimulator;
beforeEach(() => {
    sim = new OpSignSimulator();
});

// ─────────────────────────────────────────────────────────────────────────────
// Double-sign rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('Double-sign rejection', () => {
    it('same hash, same signer → second sign throws', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        expect(() => sim.signDocument(EMPTY_FILE_HASH, ALICE)).toThrow('already registered');
    });

    it('same hash, different signer → still throws (hash is unique key)', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        expect(() => sim.signDocument(EMPTY_FILE_HASH, BOB)).toThrow('already registered');
    });

    it('double-sign does not corrupt the original record', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        try { sim.signDocument(EMPTY_FILE_HASH, BOB); } catch { /* expected */ }

        const result = sim.verifyDocument(EMPTY_FILE_HASH);
        expect(result.signer).toBe(ALICE); // original signer preserved
    });

    it('double-sign does not increment the counter', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        try { sim.signDocument(EMPTY_FILE_HASH, BOB); } catch { /* expected */ }
        expect(sim.getDocCount()).toBe(1n);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wrong-signer revoke rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('Wrong-signer revoke rejection', () => {
    it('non-signer cannot revoke', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        expect(() => sim.revokeDocument(EMPTY_FILE_HASH, BOB)).toThrow('Not the original signer');
    });

    it('rejected revoke attempt leaves the document active', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        try { sim.revokeDocument(EMPTY_FILE_HASH, BOB); } catch { /* expected */ }

        const result = sim.verifyDocument(EMPTY_FILE_HASH);
        expect(result.revoked).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Double-revoke rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('Double-revoke rejection', () => {
    it('revoking an already-revoked document throws', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        sim.revokeDocument(EMPTY_FILE_HASH, ALICE);
        expect(() => sim.revokeDocument(EMPTY_FILE_HASH, ALICE)).toThrow('Already revoked');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Revoke without sign
// ─────────────────────────────────────────────────────────────────────────────

describe('Revoke without prior sign', () => {
    it('revoking an unregistered hash throws', () => {
        expect(() => sim.revokeDocument(0xdeadbeefn, ALICE)).toThrow('Document not found');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge hash values
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge hash values', () => {
    it('hash = 0n can be registered and verified', () => {
        // The contract uses 0n as "not found" sentinel — if a doc with hash 0n
        // is signed the signer must be non-zero to distinguish it.
        // The simulator reflects the contract's actual storage: hash=0 is a valid key.
        sim.signDocument(0n, ALICE);
        const result = sim.verifyDocument(0n);
        expect(result.signer).toBe(ALICE);
    });

    it('maximum u256 hash can be registered', () => {
        sim.signDocument(MAX_U256, ALICE);
        const result = sim.verifyDocument(MAX_U256);
        expect(result.signer).toBe(ALICE);
        expect(result.revoked).toBe(false);
    });

    it('max u256 hash can be revoked', () => {
        sim.signDocument(MAX_U256, ALICE);
        sim.revokeDocument(MAX_U256, ALICE);
        expect(sim.verifyDocument(MAX_U256).revoked).toBe(true);
    });

    it('adjacent hashes are independent (off-by-one)', () => {
        const h1 = 0x100n;
        const h2 = 0x101n;

        sim.signDocument(h1, ALICE);
        expect(sim.verifyDocument(h2).signer).toBe(0n); // h2 not found
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verify unregistered document
// ─────────────────────────────────────────────────────────────────────────────

describe('Verify unregistered document', () => {
    it('returns exists=false for unknown hash', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.exists).toBe(false);
    });

    it('returns zero signer for unknown hash', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.signer).toBe(0n);
    });

    it('returns zero block height for unknown hash', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.blockHeight).toBe(0n);
    });

    it('returns revoked=false for unknown hash', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.revoked).toBe(false);
    });

    it('exists=true after signing', () => {
        sim.signDocument(0x1n, ALICE);
        const result = sim.verifyDocument(0x1n);
        expect(result.exists).toBe(true);
    });

    it('exists=true even after revocation', () => {
        sim.signDocument(0x2n, ALICE);
        sim.revokeDocument(0x2n, ALICE);
        const result = sim.verifyDocument(0x2n);
        expect(result.exists).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Counter invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('Counter invariants', () => {
    it('counter never decrements below zero', () => {
        // Nothing signed, counter stays at 0
        expect(sim.getDocCount()).toBe(0n);
    });

    it('per-signer counter for unknown address is 0', () => {
        expect(sim.getSignerDocCount(0xdeadbeefn)).toBe(0n);
    });

    it('total = sum of individual signer counts after mixed operations', () => {
        sim.signDocument(1n, ALICE);
        sim.signDocument(2n, ALICE);
        sim.signDocument(3n, BOB);
        sim.signDocument(4n, BOB);
        sim.revokeDocument(1n, ALICE); // revoke doesn't change counters

        const total = sim.getDocCount();
        const individual = sim.getSignerDocCount(ALICE) + sim.getSignerDocCount(BOB);
        expect(total).toBe(individual);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// State isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('State isolation', () => {
    it('each test gets a fresh simulator (counter starts at 0)', () => {
        // If state leaked from a previous test this would fail
        expect(sim.getDocCount()).toBe(0n);
    });

    it('signing in one simulator does not affect another', () => {
        const sim2 = new OpSignSimulator();
        sim.signDocument(EMPTY_FILE_HASH, ALICE);

        expect(sim2.verifyDocument(EMPTY_FILE_HASH).signer).toBe(0n);
    });
});
