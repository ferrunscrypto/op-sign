/**
 * hashDocument.ts — Browser-side SHA-256 hashing via Web Crypto API.
 *
 * Files are hashed entirely in the browser; nothing is uploaded.
 * The resulting BigInt matches what the contract stores as a u256.
 */

/** Hash a File and return its SHA-256 digest as a BigInt (u256) */
export async function hashDocumentToU256(file: File): Promise<bigint> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return BigInt('0x' + hex);
}

/** Format a hash BigInt as a 0x-prefixed 64-char hex string */
export function formatHashHex(hash: bigint): string {
    return '0x' + hash.toString(16).padStart(64, '0');
}

/** Truncate a hash for display: show first 18 + last 6 chars */
export function truncateHash(hash: string, prefixLen = 18, suffixLen = 6): string {
    if (hash.length <= prefixLen + suffixLen) return hash;
    return `${hash.slice(0, prefixLen)}…${hash.slice(-suffixLen)}`;
}
