export interface StoredDocument {
    hash: string;      // '0x' + hex
    filename: string;
    signedAt: number;  // ms timestamp
    txId: string;
}

const LEGACY_KEY = 'opsign:documents:v1';

function walletKey(walletAddress: string): string {
    return `opsign:documents:v2:${walletAddress.toLowerCase()}`;
}

/** Migrate legacy global-key docs into the per-wallet key (runs once per wallet). */
function migrateLegacy(walletAddress: string): void {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    try {
        const legacy = JSON.parse(raw) as StoredDocument[];
        if (!Array.isArray(legacy) || legacy.length === 0) { localStorage.removeItem(LEGACY_KEY); return; }
        const key = walletKey(walletAddress);
        const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as StoredDocument[];
        const existingHashes = new Set(existing.map(d => d.hash));
        const merged = [...legacy.filter(d => !existingHashes.has(d.hash)), ...existing];
        localStorage.setItem(key, JSON.stringify(merged));
        localStorage.removeItem(LEGACY_KEY);
    } catch { /* ignore */ }
}

export function getStoredDocuments(walletAddress: string): StoredDocument[] {
    migrateLegacy(walletAddress);
    try {
        return JSON.parse(localStorage.getItem(walletKey(walletAddress)) ?? '[]') as StoredDocument[];
    } catch { return []; }
}

export function addStoredDocument(walletAddress: string, doc: StoredDocument): void {
    const docs = getStoredDocuments(walletAddress);
    if (docs.some(d => d.hash === doc.hash)) return;
    docs.unshift(doc);
    localStorage.setItem(walletKey(walletAddress), JSON.stringify(docs));
}

export function removeStoredDocument(walletAddress: string, hash: string): void {
    const docs = getStoredDocuments(walletAddress).filter(d => d.hash !== hash);
    localStorage.setItem(walletKey(walletAddress), JSON.stringify(docs));
}
