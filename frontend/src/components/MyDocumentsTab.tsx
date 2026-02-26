import { useState, useEffect, useCallback, useRef } from 'react';
import { Network } from '@btc-vision/bitcoin';
import { getContract, TransactionParameters } from 'opnet';
import { getStoredDocuments, removeStoredDocument, addStoredDocument, StoredDocument } from '../utils/documentStore';
import { useOpSignContract } from '../hooks/useOpSign';
import { useProvider } from '../hooks/useProvider';
import { resolveAddress } from '../utils/resolveAddress';
import { getTransactionUrl } from '../config/networks';
import { getContractAddress } from '../config/contracts';
import { OpSignAbi } from '../abi/OpSignABI';

interface Props {
    readonly network: Network | null | undefined;
    readonly walletAddress: string | null | undefined;
    readonly connected: boolean;
    readonly onConnect: () => void;
    readonly connecting: boolean;
}

interface OnChainData {
    exists: boolean;
    blockHeight: bigint;
    revoked: boolean;
    loading: boolean;
    error: string;
}

function truncateHash(h: string, start = 10, end = 6): string {
    return h.length > start + end + 3 ? `${h.slice(0, start)}…${h.slice(-end)}` : h;
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MyDocumentsTab({ network, walletAddress, connected, onConnect, connecting }: Props) {
    const contract = useOpSignContract(network);
    const provider = useProvider(network);
    const [docs, setDocs] = useState<StoredDocument[]>([]);
    const [onChain, setOnChain] = useState<Record<string, OnChainData>>({});
    const [revoking, setRevoking] = useState<string | null>(null);
    const [revokeError, setRevokeError] = useState<Record<string, string>>({});
    const [pendingRevoke, setPendingRevoke] = useState<{ hash: string; txId: string } | null>(null);
    const [addInput, setAddInput] = useState('');
    const [addError, setAddError] = useState('');
    const resolvedSenderRef = useRef<import('@btc-vision/transaction').Address | null>(null);
    const resolvedSenderForRef = useRef<string | null>(null);

    const loadDocs = useCallback(() => {
        setDocs(getStoredDocuments());
    }, []);

    useEffect(() => { loadDocs(); }, [loadDocs, walletAddress]);

    // Fetch on-chain data for each doc
    useEffect(() => {
        if (!contract || docs.length === 0) return;
        for (const doc of docs) {
            if (onChain[doc.hash]?.loading === false) continue; // already loaded
            setOnChain(prev => ({ ...prev, [doc.hash]: { exists: false, blockHeight: 0n, revoked: false, loading: true, error: '' } }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawHash = doc.hash.replace(/^(0x)+/, '0x');
            (contract._verifyDocument(BigInt(rawHash)) as Promise<any>)
                .then((r: any) => {
                    const p = r?.properties;
                    setOnChain(prev => ({
                        ...prev,
                        [doc.hash]: {
                            exists: Boolean(p?.exists),
                            blockHeight: (p?.blockHeight as bigint) ?? 0n,
                            revoked: Boolean(p?.revoked),
                            loading: false,
                            error: '',
                        },
                    }));
                })
                .catch(() => {
                    setOnChain(prev => ({
                        ...prev,
                        [doc.hash]: { exists: false, blockHeight: 0n, revoked: false, loading: false, error: 'Failed to fetch' },
                    }));
                });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contract, docs]);

    // Poll pending revoke confirmation
    useEffect(() => {
        if (!pendingRevoke || !provider) return;
        let cancelled = false;
        const { hash, txId } = pendingRevoke;
        const poll = async () => {
            try {
                const tx = await provider.getTransaction(txId);
                if (cancelled) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (tx && (tx as any).blockNumber != null) {
                    setPendingRevoke(null);
                    setRevoking(null);
                    // Refresh on-chain data for this hash
                    setOnChain(prev => ({ ...prev, [hash]: { exists: prev[hash]?.exists ?? false, blockHeight: prev[hash]?.blockHeight ?? 0n, revoked: prev[hash]?.revoked ?? false, loading: true, error: '' } }));
                }
            } catch { /* not yet mined */ }
        };
        void poll();
        const interval = setInterval(() => { void poll(); }, 5000);
        const timeout = setTimeout(() => { if (!cancelled) { setPendingRevoke(null); setRevoking(null); } }, 60_000);
        return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
    }, [pendingRevoke, provider]);

    const handleRevoke = useCallback(async (hash: string) => {
        if (!walletAddress || !network || !provider) return;
        setRevoking(hash);
        setRevokeError(prev => ({ ...prev, [hash]: '' }));
        try {
            if (resolvedSenderRef.current === null || resolvedSenderForRef.current !== walletAddress) {
                resolvedSenderRef.current = await resolveAddress(walletAddress, provider);
                resolvedSenderForRef.current = walletAddress;
            }
            const contractAddress = getContractAddress('opSign', network);
            if (!contractAddress) { setRevokeError(prev => ({ ...prev, [hash]: 'Contract not available.' })); return; }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const writeContract = getContract<any>(contractAddress, OpSignAbi as never, provider, network, resolvedSenderRef.current ?? undefined);
            const simulation = await writeContract._revokeDocument(BigInt(hash.replace(/^(0x)+/, '0x')));
            if (simulation.revert) { setRevokeError(prev => ({ ...prev, [hash]: String(simulation.revert) })); setRevoking(null); return; }

            const params: TransactionParameters = { signer: null, mldsaSigner: null, refundTo: walletAddress, maximumAllowedSatToSpend: 100_000n, feeRate: 10, network };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (provider as any).utxoManager?.clean();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await simulation.sendTransaction(params) as any;
            if (!result || result.error) { setRevokeError(prev => ({ ...prev, [hash]: String(result?.error ?? 'Transaction failed') })); setRevoking(null); return; }
            const txId = String(result.transactionId ?? result.txid ?? result.result ?? '');
            if (txId) { setPendingRevoke({ hash, txId }); }
            else { setRevoking(null); }
        } catch (e: unknown) {
            setRevokeError(prev => ({ ...prev, [hash]: e instanceof Error ? e.message : 'Revoke failed' }));
            setRevoking(null);
        }
    }, [walletAddress, network, provider]);

    const handleRemove = useCallback((hash: string) => {
        removeStoredDocument(hash);
        setDocs(getStoredDocuments());
    }, []);

    const handleAddManual = useCallback(() => {
        const raw = addInput.trim().toLowerCase();
        if (!raw) return;
        const hex = raw.startsWith('0x') ? raw : '0x' + raw;
        if (!/^0x[0-9a-f]{1,64}$/.test(hex)) { setAddError('Invalid hash — must be a hex string up to 64 characters.'); return; }
        addStoredDocument({ hash: hex, filename: 'Manual entry', signedAt: Date.now(), txId: '' });
        setAddInput('');
        setAddError('');
        setDocs(getStoredDocuments());
        // Force on-chain reload for this hash
        setOnChain(prev => { const next = { ...prev }; delete next[hex]; return next; });
    }, [addInput]);

    if (!connected) {
        return (
            <div className="tab-content">
                <h2 className="tab-title">My Documents</h2>
                <p className="tab-desc">Connect your wallet to view your signed documents.</p>
                <button className="btn-primary" onClick={onConnect} disabled={connecting} style={{ marginTop: '1.5rem' }}>
                    {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
            </div>
        );
    }

    return (
        <div className="tab-content">
            <h2 className="tab-title">My Documents</h2>
            <p className="tab-desc">
                Documents you have notarised on Bitcoin L1. Stored locally in your browser — hashes are verified live against the chain.
            </p>

            {docs.length === 0 ? (
                <div className="mydocs-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>No documents yet. Sign a document to see it here.</p>
                </div>
            ) : (
                <div className="mydocs-list">
                    {docs.map(doc => {
                        const chain = onChain[doc.hash];
                        const isRevoking = revoking === doc.hash;
                        const isPendingRevoke = pendingRevoke?.hash === doc.hash;
                        return (
                            <div key={doc.hash} className={`mydocs-card${chain?.revoked ? ' mydocs-card--revoked' : ''}`}>
                                <div className="mydocs-card__header">
                                    <div className="mydocs-card__name">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        {doc.filename}
                                    </div>
                                    <div className="mydocs-card__badges">
                                        {chain?.loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
                                        {chain && !chain.loading && (
                                            chain.revoked
                                                ? <span className="badge badge--revoked">Revoked</span>
                                                : chain.exists
                                                    ? <span className="badge badge--active">Active</span>
                                                    : <span className="badge badge--unknown">Not found</span>
                                        )}
                                    </div>
                                </div>

                                <div className="mydocs-card__rows">
                                    <div className="mydocs-card__row">
                                        <span className="mydocs-card__label">Hash</span>
                                        <span className="mydocs-card__value mydocs-card__mono">{truncateHash(doc.hash)}</span>
                                    </div>
                                    {chain?.exists && !chain.loading && (
                                        <div className="mydocs-card__row">
                                            <span className="mydocs-card__label">Block</span>
                                            <span className="mydocs-card__value">{chain.blockHeight.toString()}</span>
                                        </div>
                                    )}
                                    {doc.signedAt > 0 && (
                                        <div className="mydocs-card__row">
                                            <span className="mydocs-card__label">Signed</span>
                                            <span className="mydocs-card__value">{formatDate(doc.signedAt)}</span>
                                        </div>
                                    )}
                                    {doc.txId && network && (
                                        <div className="mydocs-card__row">
                                            <span className="mydocs-card__label">Tx</span>
                                            <a className="mydocs-card__link" href={getTransactionUrl(network, doc.txId)} target="_blank" rel="noopener noreferrer">
                                                {doc.txId.slice(0, 14)}… ↗
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {revokeError[doc.hash] && (
                                    <div className="alert alert--error" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                        {revokeError[doc.hash]}
                                    </div>
                                )}

                                {isPendingRevoke && (
                                    <div className="pending-banner" style={{ marginTop: '0.5rem', padding: '0.75rem 1rem' }}>
                                        <span className="spinner" />
                                        <div className="pending-banner__text">
                                            <strong>Revocation submitted — waiting for confirmation…</strong>
                                        </div>
                                        {network && (
                                            <a className="pending-banner__link" href={getTransactionUrl(network, pendingRevoke!.txId)} target="_blank" rel="noopener noreferrer">
                                                View on OPScan →
                                            </a>
                                        )}
                                    </div>
                                )}

                                <div className="mydocs-card__actions">
                                    {chain?.exists && !chain.revoked && !isPendingRevoke && (
                                        <button
                                            className="btn-danger"
                                            onClick={() => void handleRevoke(doc.hash)}
                                            disabled={isRevoking || !!revoking}
                                        >
                                            {isRevoking ? <><span className="spinner" /> Revoking…</> : 'Revoke'}
                                        </button>
                                    )}
                                    <button className="btn-ghost" onClick={() => handleRemove(doc.hash)}>
                                        Remove from list
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Manual hash add */}
            <div className="mydocs-add">
                <h3 className="mydocs-add__title">Add by hash</h3>
                <p className="mydocs-add__desc">Signed from another device? Paste the document hash to track it here.</p>
                <div className="signer-lookup__row">
                    <input
                        className="signer-lookup__input"
                        type="text"
                        placeholder="0xabcd… or hex without 0x"
                        value={addInput}
                        onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                        spellCheck={false}
                    />
                    <button className="btn-primary" onClick={handleAddManual} disabled={!addInput.trim()}>
                        Add
                    </button>
                </div>
                {addError && <div className="alert alert--error" style={{ marginTop: '0.5rem' }}>{addError}</div>}
            </div>
        </div>
    );
}
