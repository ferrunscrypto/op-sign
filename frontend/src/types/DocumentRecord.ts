/**
 * Represents the on-chain record for a signed document.
 *
 * `signer` is a u256 (bigint). A value of 0n means the document was never
 * registered — use `isDocumentFound()` to check.
 */
export interface DocumentRecord {
    readonly signer: bigint;       // u256; 0n = not registered
    readonly blockHeight: bigint;  // Bitcoin block number at time of signing
    readonly revoked: boolean;     // true if the signer subsequently revoked
}

/** Returns true if the document has been registered on-chain */
export function isDocumentFound(record: DocumentRecord): boolean {
    return record.signer !== 0n;
}

/** Convert a signer u256 to a 0x-prefixed 64-char hex string */
export function signerToHex(signer: bigint): string {
    return '0x' + signer.toString(16).padStart(64, '0');
}

/** Truncate a hex signer for display */
export function truncateSigner(signer: bigint, prefixLen = 10, suffixLen = 6): string {
    const hex = signerToHex(signer);
    return `${hex.slice(0, 2 + prefixLen)}…${hex.slice(-suffixLen)}`;
}
