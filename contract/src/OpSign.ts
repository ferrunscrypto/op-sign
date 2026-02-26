import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    NetEvent,
    OP_NET,
    Revert,
    StoredU256,
    SafeMath,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
import { StoredMapU256 } from '@btc-vision/btc-runtime/runtime/storage/maps/StoredMapU256';
import { AddressMemoryMap } from '@btc-vision/btc-runtime/runtime/memory/AddressMemoryMap';

// ── Events ─────────────────────────────────────────────────────────────────

class DocumentSignedEvent extends NetEvent {
    constructor(hash: u256, signer: u256, blockHeight: u64) {
        // hash(32) + signer(32) + blockHeight(8) = 72 bytes
        const data = new BytesWriter(72);
        data.writeU256(hash);
        data.writeU256(signer);
        data.writeU64(blockHeight);
        super('DocumentSigned', data);
    }
}

class DocumentRevokedEvent extends NetEvent {
    constructor(hash: u256, signer: u256) {
        // hash(32) + signer(32) = 64 bytes
        const data = new BytesWriter(64);
        data.writeU256(hash);
        data.writeU256(signer);
        super('DocumentRevoked', data);
    }
}

/**
 * OpSign — Decentralized Document Notary on Bitcoin L1.
 *
 * Documents are never stored on-chain — only their SHA-256 hashes.
 * Provides tamper-evident, immutable proof that a specific document existed
 * at a specific Bitcoin block height and was attested by a specific signer.
 *
 * Features
 * ─────────
 *  • _signDocument   — Register a document hash, signer, and block height
 *  • _revokeDocument — Revoke a document (original signer only)
 *  • _verifyDocument — Read signer, block, and revoked status for any hash
 *  • _getDocCount    — Total documents signed platform-wide
 *  • _getSignerDocCount — Documents signed by a specific address
 */
export class OpSign extends OP_NET {

    // ── Storage pointers (each Blockchain.nextPointer = unique u16 slot) ──────
    private readonly _docSignerPtr: u16 = Blockchain.nextPointer;
    private readonly _docBlockPtr: u16 = Blockchain.nextPointer;
    private readonly _docRevokedPtr: u16 = Blockchain.nextPointer;
    private readonly _totalDocCountPtr: u16 = Blockchain.nextPointer;
    private readonly _signerCountPtr: u16 = Blockchain.nextPointer;

    // ── Storage: hash → signer address (stored as u256) ───────────────────────
    private readonly docSigner: StoredMapU256 = new StoredMapU256(this._docSignerPtr);

    // ── Storage: hash → block number at signing (stored as u256) ──────────────
    private readonly docBlock: StoredMapU256 = new StoredMapU256(this._docBlockPtr);

    // ── Storage: hash → revoked flag (u256.Zero = active, u256.One = revoked) ─
    // NOTE: btc-runtime has no keyed boolean map type; u256 is the only option
    // for a per-hash revocation flag. Each slot stores 0 (active) or 1 (revoked).
    private readonly docRevoked: StoredMapU256 = new StoredMapU256(this._docRevokedPtr);

    // ── Storage: platform-wide total documents signed ──────────────────────────
    private readonly totalDocCount: StoredU256 = new StoredU256(this._totalDocCountPtr, EMPTY_POINTER);

    // ── Storage: signer address → number of documents signed ──────────────────
    private readonly signerDocCount: AddressMemoryMap = new AddressMemoryMap(this._signerCountPtr);

    public constructor() {
        super();
    }

    // ── Deployment ────────────────────────────────────────────────────────────

    public override onDeployment(_calldata: Calldata): void {
        // Storage is zero-initialised by the OPNet runtime; no explicit setup needed.
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Encode an Address (Uint8Array) as u256 for storage */
    private addressToU256(addr: Address): u256 {
        return u256.fromUint8ArrayBE(addr);
    }

    // ── Sign Document ──────────────────────────────────────────────────────────

    @method({ name: 'hash', type: ABIDataTypes.UINT256 })
    private _signDocument(calldata: Calldata): BytesWriter {
        const hash: u256 = calldata.readU256();
        const signer: Address = Blockchain.tx.sender;
        const signerU256: u256 = this.addressToU256(signer);

        // Revert if the document hash has already been registered
        const existing: u256 = this.docSigner.get(hash);
        if (!existing.isZero()) {
            throw new Revert('Document already registered');
        }

        const blockHeight: u64 = Blockchain.block.number;

        // Persist the signing record
        this.docSigner.set(hash, signerU256);
        this.docBlock.set(hash, u256.fromU64(blockHeight));
        this.docRevoked.set(hash, u256.Zero);

        // Increment platform-wide counter
        this.totalDocCount.set(SafeMath.add(this.totalDocCount.value, u256.One));

        // Increment per-signer counter
        const prevCount: u256 = this.signerDocCount.get(signer);
        this.signerDocCount.set(signer, SafeMath.add(prevCount, u256.One));

        this.emitEvent(new DocumentSignedEvent(hash, signerU256, blockHeight));

        return new BytesWriter(0);
    }

    // ── Revoke Document ────────────────────────────────────────────────────────

    @method({ name: 'hash', type: ABIDataTypes.UINT256 })
    private _revokeDocument(calldata: Calldata): BytesWriter {
        const hash: u256 = calldata.readU256();
        const caller: Address = Blockchain.tx.sender;
        const callerU256: u256 = this.addressToU256(caller);

        // Revert if the document was never registered
        const storedSigner: u256 = this.docSigner.get(hash);
        if (storedSigner.isZero()) {
            throw new Revert('Document not found');
        }

        // Only the original signer may revoke
        if (storedSigner != callerU256) {
            throw new Revert('Not the document signer');
        }

        // Revert if already revoked
        const revoked: u256 = this.docRevoked.get(hash);
        if (!revoked.isZero()) {
            throw new Revert('Document already revoked');
        }

        this.docRevoked.set(hash, u256.One);
        this.emitEvent(new DocumentRevokedEvent(hash, callerU256));

        return new BytesWriter(0);
    }

    // ── Verify Document (read-only simulation) ─────────────────────────────────

    @method({ name: 'hash', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'exists', type: ABIDataTypes.BOOL },
        { name: 'signer', type: ABIDataTypes.UINT256 },
        { name: 'blockHeight', type: ABIDataTypes.UINT256 },
        { name: 'revoked', type: ABIDataTypes.BOOL },
    )
    private _verifyDocument(calldata: Calldata): BytesWriter {
        const hash: u256 = calldata.readU256();

        const signerU256: u256 = this.docSigner.get(hash);
        const blockHeight: u256 = this.docBlock.get(hash);
        const revokedVal: u256 = this.docRevoked.get(hash);

        // exists is the explicit on-chain signal; consumers must not rely on signer==0
        // as a sentinel — use exists instead.
        const exists: bool = !signerU256.isZero();
        const isRevoked: bool = exists && !revokedVal.isZero();

        // exists(1) + signer(32) + blockHeight(32) + revoked(1) = 66 bytes
        const writer: BytesWriter = new BytesWriter(66);
        writer.writeBoolean(exists);
        writer.writeU256(signerU256);
        writer.writeU256(blockHeight);
        writer.writeBoolean(isRevoked);
        return writer;
    }

    // ── Get Total Document Count ───────────────────────────────────────────────

    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    private _getDocCount(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this.totalDocCount.value);
        return writer;
    }

    // ── Get Signer Document Count ──────────────────────────────────────────────

    @method({ name: 'signer', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    private _getSignerDocCount(calldata: Calldata): BytesWriter {
        const signer: Address = calldata.readAddress();
        const count: u256 = this.signerDocCount.get(signer);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(count);
        return writer;
    }
}
