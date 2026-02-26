/**
 * OpSignSimulator.ts
 *
 * Pure-TypeScript mirror of the OpSign AssemblyScript contract.
 * Used by integration, regression, and simulation tests to exercise business
 * logic without spinning up a WASM runtime.
 */

export interface DocRecord {
    readonly signer: bigint;       // u256 address of original signer
    readonly blockHeight: bigint;  // block at signing
    readonly revoked: boolean;
}

export interface VerifyResult {
    exists: boolean;
    signer: bigint;
    blockHeight: bigint;
    revoked: boolean;
}

export class OpSignSimulator {
    // Storage mirrors
    private readonly docSigner = new Map<bigint, bigint>();
    private readonly docBlock = new Map<bigint, bigint>();
    private readonly docRevoked = new Map<bigint, boolean>();
    private readonly signerDocCount = new Map<bigint, bigint>();
    private totalDocCount = 0n;

    /** Simulated block number — advance between transactions */
    public currentBlock = 100n;

    // ── _signDocument ───────────────────────────────────────────────────────────

    /**
     * Register a hash. Throws if already registered (mirrors contract Revert).
     */
    signDocument(hash: bigint, signer: bigint): void {
        if (this.docSigner.has(hash)) {
            throw new Error('Document already registered');
        }
        this.docSigner.set(hash, signer);
        this.docBlock.set(hash, this.currentBlock);
        this.docRevoked.set(hash, false);
        this.totalDocCount += 1n;
        const prev = this.signerDocCount.get(signer) ?? 0n;
        this.signerDocCount.set(signer, prev + 1n);
    }

    // ── _revokeDocument ─────────────────────────────────────────────────────────

    /**
     * Revoke a hash. Throws on: not found / wrong caller / already revoked.
     */
    revokeDocument(hash: bigint, caller: bigint): void {
        const signer = this.docSigner.get(hash);
        if (signer === undefined) {
            throw new Error('Document not found');
        }
        if (signer !== caller) {
            throw new Error('Not the original signer');
        }
        if (this.docRevoked.get(hash) === true) {
            throw new Error('Already revoked');
        }
        this.docRevoked.set(hash, true);
    }

    // ── _verifyDocument ─────────────────────────────────────────────────────────

    /**
     * Returns zeros for an unregistered hash (mirrors contract behaviour).
     */
    verifyDocument(hash: bigint): VerifyResult {
        const signer = this.docSigner.get(hash);
        if (signer === undefined) {
            return { exists: false, signer: 0n, blockHeight: 0n, revoked: false };
        }
        return {
            exists: true,
            signer,
            blockHeight: this.docBlock.get(hash)!,
            revoked: this.docRevoked.get(hash) ?? false,
        };
    }

    // ── _getDocCount ─────────────────────────────────────────────────────────────

    getDocCount(): bigint {
        return this.totalDocCount;
    }

    // ── _getSignerDocCount ───────────────────────────────────────────────────────

    getSignerDocCount(signer: bigint): bigint {
        return this.signerDocCount.get(signer) ?? 0n;
    }

    // ── Helpers for tests ────────────────────────────────────────────────────────

    /** Advance the simulated block number by n blocks */
    advanceBlock(n = 1n): void {
        this.currentBlock += n;
    }

    /** Snapshot the entire registry for regression checks */
    snapshot(): { totalDocCount: bigint; registrations: number } {
        return {
            totalDocCount: this.totalDocCount,
            registrations: this.docSigner.size,
        };
    }
}

// ── Constant test addresses ───────────────────────────────────────────────────

export const ALICE = 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAn;
export const BOB   = 0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBn;
export const CAROL = 0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCn;

/** SHA-256 of empty string (well-known) */
export const EMPTY_FILE_HASH = BigInt(
    '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
);

/** SHA-256 of "hello world" */
export const HELLO_HASH = BigInt(
    '0xb94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f730d4b8a5a37e5e',
);

/** Maximum u256 value */
export const MAX_U256 = (1n << 256n) - 1n;
