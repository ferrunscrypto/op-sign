import { describe, it, expect, beforeEach } from 'vitest';
import {
    OpSignSimulator,
    ALICE,
    BOB,
    CAROL,
    EMPTY_FILE_HASH,
    HELLO_HASH,
} from './helpers/OpSignSimulator';

// Each test suite gets a fresh simulator instance
let sim: OpSignSimulator;
beforeEach(() => {
    sim = new OpSignSimulator();
});

// ─────────────────────────────────────────────────────────────────────────────
// Full document lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Full document lifecycle', () => {
    it('sign → verify: returns correct signer and block height', () => {
        sim.signDocument(EMPTY_FILE_HASH, ALICE);

        const result = sim.verifyDocument(EMPTY_FILE_HASH);
        expect(result.exists).toBe(true);
        expect(result.signer).toBe(ALICE);
        expect(result.blockHeight).toBe(100n);  // default currentBlock
        expect(result.revoked).toBe(false);
    });

    it('sign → verify → revoke → verify: shows revoked flag', () => {
        sim.signDocument(HELLO_HASH, ALICE);
        const before = sim.verifyDocument(HELLO_HASH);
        expect(before.exists).toBe(true);
        expect(before.revoked).toBe(false);

        sim.revokeDocument(HELLO_HASH, ALICE);

        const after = sim.verifyDocument(HELLO_HASH);
        expect(after.exists).toBe(true);
        expect(after.signer).toBe(ALICE);
        expect(after.revoked).toBe(true);
    });

    it('block height is recorded at signing time, not revocation time', () => {
        sim.advanceBlock(50n);  // currentBlock = 150
        sim.signDocument(EMPTY_FILE_HASH, ALICE);
        sim.advanceBlock(200n); // currentBlock = 350

        sim.revokeDocument(EMPTY_FILE_HASH, ALICE);
        const result = sim.verifyDocument(EMPTY_FILE_HASH);
        expect(result.blockHeight).toBe(150n);
    });

    it('after revocation the signer is still visible (not wiped)', () => {
        sim.signDocument(HELLO_HASH, BOB);
        sim.revokeDocument(HELLO_HASH, BOB);

        const result = sim.verifyDocument(HELLO_HASH);
        expect(result.signer).toBe(BOB);
        expect(result.revoked).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-signer scenario
// ─────────────────────────────────────────────────────────────────────────────

describe('Multi-signer / multi-document', () => {
    it('three different hashes signed by three different signers', () => {
        const hashes = [EMPTY_FILE_HASH, HELLO_HASH, 0x1234n];
        const signers = [ALICE, BOB, CAROL];

        hashes.forEach((h, i) => sim.signDocument(h, signers[i]!));

        hashes.forEach((h, i) => {
            const result = sim.verifyDocument(h);
            expect(result.signer).toBe(signers[i]);
            expect(result.revoked).toBe(false);
        });
    });

    it('the same signer can sign multiple different hashes', () => {
        const h1 = 0xaaa1n;
        const h2 = 0xaaa2n;
        const h3 = 0xaaa3n;

        sim.signDocument(h1, ALICE);
        sim.signDocument(h2, ALICE);
        sim.signDocument(h3, ALICE);

        expect(sim.getSignerDocCount(ALICE)).toBe(3n);
    });

    it('revoking one document does not affect others by the same signer', () => {
        const h1 = 0xb1n;
        const h2 = 0xb2n;

        sim.signDocument(h1, ALICE);
        sim.signDocument(h2, ALICE);
        sim.revokeDocument(h1, ALICE);

        expect(sim.verifyDocument(h1).revoked).toBe(true);
        expect(sim.verifyDocument(h2).revoked).toBe(false);
    });

    it('two signers can independently revoke their own documents', () => {
        const h1 = 0xc1n;
        const h2 = 0xc2n;

        sim.signDocument(h1, ALICE);
        sim.signDocument(h2, BOB);

        sim.revokeDocument(h1, ALICE);
        sim.revokeDocument(h2, BOB);

        expect(sim.verifyDocument(h1).revoked).toBe(true);
        expect(sim.verifyDocument(h2).revoked).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global counter tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('Global document counter', () => {
    it('starts at zero', () => {
        expect(sim.getDocCount()).toBe(0n);
    });

    it('increments once per sign', () => {
        sim.signDocument(0x1n, ALICE);
        expect(sim.getDocCount()).toBe(1n);
        sim.signDocument(0x2n, BOB);
        expect(sim.getDocCount()).toBe(2n);
        sim.signDocument(0x3n, CAROL);
        expect(sim.getDocCount()).toBe(3n);
    });

    it('does NOT increment on revoke', () => {
        sim.signDocument(0x1n, ALICE);
        sim.revokeDocument(0x1n, ALICE);
        expect(sim.getDocCount()).toBe(1n);
    });

    it('10 signs → counter is 10', () => {
        for (let i = 1n; i <= 10n; i++) {
            sim.signDocument(i * 0x100n, ALICE);
        }
        expect(sim.getDocCount()).toBe(10n);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-signer counter tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('Per-signer document counter', () => {
    it('new address returns 0', () => {
        expect(sim.getSignerDocCount(ALICE)).toBe(0n);
    });

    it('tracks independently per signer', () => {
        sim.signDocument(0x1n, ALICE);
        sim.signDocument(0x2n, ALICE);
        sim.signDocument(0x3n, BOB);

        expect(sim.getSignerDocCount(ALICE)).toBe(2n);
        expect(sim.getSignerDocCount(BOB)).toBe(1n);
        expect(sim.getSignerDocCount(CAROL)).toBe(0n);
    });

    it('revoke does NOT decrement per-signer count', () => {
        sim.signDocument(0x1n, ALICE);
        sim.signDocument(0x2n, ALICE);
        sim.revokeDocument(0x1n, ALICE);

        expect(sim.getSignerDocCount(ALICE)).toBe(2n);
    });

    it('total count equals sum of all signer counts (no revoke effect)', () => {
        sim.signDocument(0x1n, ALICE);
        sim.signDocument(0x2n, ALICE);
        sim.signDocument(0x3n, BOB);
        sim.signDocument(0x4n, CAROL);

        const aliceCount = sim.getSignerDocCount(ALICE);
        const bobCount = sim.getSignerDocCount(BOB);
        const carolCount = sim.getSignerDocCount(CAROL);

        expect(aliceCount + bobCount + carolCount).toBe(sim.getDocCount());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block progression
// ─────────────────────────────────────────────────────────────────────────────

describe('Block height progression', () => {
    it('successive signs at different blocks record correct heights', () => {
        sim.advanceBlock(10n);  // 110
        sim.signDocument(0x1n, ALICE);

        sim.advanceBlock(50n);  // 160
        sim.signDocument(0x2n, BOB);

        sim.advanceBlock(200n); // 360
        sim.signDocument(0x3n, CAROL);

        expect(sim.verifyDocument(0x1n).blockHeight).toBe(110n);
        expect(sim.verifyDocument(0x2n).blockHeight).toBe(160n);
        expect(sim.verifyDocument(0x3n).blockHeight).toBe(360n);
    });
});
