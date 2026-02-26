export interface StoredDocument {
    hash: string;      // '0x' + hex
    filename: string;
    signedAt: number;  // ms timestamp
    txId: string;
}

function walletKey(walletAddress: string): string {
    return `opsign:documents:v2:${walletAddress.toLowerCase()}`;
}

export function getStoredDocuments(walletAddress: string): StoredDocument[] {
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
