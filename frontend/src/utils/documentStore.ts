export interface StoredDocument {
    hash: string;      // '0x' + hex
    filename: string;
    signedAt: number;  // ms timestamp
    txId: string;
}

const KEY = 'opsign:documents:v1';

export function getStoredDocuments(): StoredDocument[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredDocument[];
    } catch { return []; }
}

export function addStoredDocument(doc: StoredDocument): void {
    const docs = getStoredDocuments();
    if (docs.some(d => d.hash === doc.hash)) return;
    docs.unshift(doc);
    localStorage.setItem(KEY, JSON.stringify(docs));
}

export function removeStoredDocument(hash: string): void {
    const docs = getStoredDocuments().filter(d => d.hash !== hash);
    localStorage.setItem(KEY, JSON.stringify(docs));
}
