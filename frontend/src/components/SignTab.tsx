import { useState, useCallback, useRef, useEffect } from 'react';
import { Network } from '@btc-vision/bitcoin';
import { getContract, TransactionParameters } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { hashDocumentToU256, formatHashHex, truncateHash } from '../utils/hashDocument';
import { addStoredDocument } from '../utils/documentStore';
import { useProvider } from '../hooks/useProvider';
import { resolveAddress } from '../utils/resolveAddress';
import { OpSignAbi } from '../abi/OpSignABI';
import { getExplorerUrl, getTransactionUrl } from '../config/networks';
import { getContractAddress } from '../config/contracts';

interface SignTabProps {
    readonly network: Network | null | undefined;
    readonly walletAddress: string | null | undefined;
    readonly connected: boolean;
    readonly onConnect: () => void;
    readonly connecting: boolean;
}

export function SignTab({ network, walletAddress, connected, onConnect, connecting }: SignTabProps) {
    const provider = useProvider(network);

    // Cache the resolved Address for the connected wallet
    const resolvedSenderRef = useRef<Address | null>(null);
    const resolvedSenderForRef = useRef<string | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [hash, setHash] = useState<bigint | null>(null);
    const [hashHex, setHashHex] = useState('');
    const [hashing, setHashing] = useState(false);
    const [signing, setSigning] = useState(false);
    const [pendingTxId, setPendingTxId] = useState('');
    const [txId, setTxId] = useState('');
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const processFile = useCallback(async (f: File) => {
        setFile(f);
        setHash(null);
        setHashHex('');
        setTxId('');
        setError('');
        setHashing(true);
        try {
            const h = await hashDocumentToU256(f);
            setHash(h);
            setHashHex(formatHashHex(h));
        } catch {
            setError('Failed to compute file hash.');
        } finally {
            setHashing(false);
        }
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void processFile(f);
        },
        [processFile],
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) void processFile(f);
    };

    const handleSign = useCallback(async () => {
        if (!hash || !walletAddress || !network || !provider) return;
        setSigning(true);
        setError('');
        try {
            // Resolve sender address so simulation uses correct tx.sender
            if (resolvedSenderRef.current === null || resolvedSenderForRef.current !== walletAddress) {
                resolvedSenderRef.current = await resolveAddress(walletAddress, provider);
                resolvedSenderForRef.current = walletAddress;
            }

            const contractAddress = getContractAddress('opSign', network);
            if (!contractAddress) {
                setError('Contract not available on this network.');
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const writeContract = getContract<any>(
                contractAddress,
                OpSignAbi as never,
                provider,
                network,
                resolvedSenderRef.current ?? undefined,
            );

            const simulation = await writeContract._signDocument(hash);

            if (simulation.revert) {
                const revert = String(simulation.revert);
                if (revert.toLowerCase().includes('already registered')) {
                    setError('This document has already been signed on-chain. Switch to the Verify tab to check its record.');
                } else {
                    setError(`Transaction would fail: ${revert}`);
                }
                return;
            }

            const params: TransactionParameters = {
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress,
                maximumAllowedSatToSpend: 100_000n,
                feeRate: 10,
                network,
            };

            // Clear stale pending UTXOs — without this, a second sign reuses the
            // unconfirmed change UTXO from the previous tx and the node rejects it
            // with "Could not decode transaction".
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (provider as any).utxoManager?.clean();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await simulation.sendTransaction(params) as any;
            if (!result || result.error) {
                setError(String(result?.error ?? 'Transaction failed'));
                return;
            }
            // sendPresignedTransaction returns { transactionId, ... }
            const submittedTxId = String(result.transactionId ?? result.txid ?? result.result ?? '');
            if (submittedTxId) {
                setPendingTxId(submittedTxId);
            } else {
                setError('Transaction sent but no ID returned. Check the explorer.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Signing failed';
            if (msg.toLowerCase().includes('already registered')) {
                setError('This document has already been signed on-chain. Switch to the Verify tab to check its record.');
            } else {
                setError(msg);
            }
        } finally {
            setSigning(false);
        }
    }, [hash, walletAddress, network, provider]);

    // Poll for transaction confirmation once submitted
    useEffect(() => {
        if (!pendingTxId || !provider) return;
        let cancelled = false;
        const confirm = (id: string) => {
            if (hashHex && file) {
                addStoredDocument({ hash: hashHex, filename: file.name, signedAt: Date.now(), txId: id });
            }
            setPendingTxId(''); setTxId(id);
        };
        const poll = async () => {
            try {
                // getTransaction returns TransactionBase with .blockNumber when mined
                const tx = await provider.getTransaction(pendingTxId);
                if (cancelled) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (tx && (tx as any).blockNumber != null) {
                    confirm(pendingTxId);
                }
            } catch {
                // Tx not yet mined — keep polling
            }
        };
        void poll();
        const interval = setInterval(() => { void poll(); }, 5000);
        // Safety: show success after 60 s even if polling fails
        const timeout = setTimeout(() => { if (!cancelled) confirm(pendingTxId); }, 60_000);
        return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
    }, [pendingTxId, provider]);

    const explorerUrl = network ? getExplorerUrl(network) : 'https://mempool.opnet.org/testnet4/tx/';

    const resetState = () => {
        setFile(null);
        setHash(null);
        setHashHex('');
        setPendingTxId('');
        setTxId('');
        setError('');
    };

    const downloadCertificate = useCallback(() => {
        if (!file || !hashHex || !txId) return;
        const lines = [
            '╔══════════════════════════════════════════════════════════════════╗',
            '║              OP-SIGN — DOCUMENT NOTARISATION CERTIFICATE         ║',
            '╚══════════════════════════════════════════════════════════════════╝',
            '',
            `Issued    : ${new Date().toUTCString()}`,
            `File      : ${file.name}`,
            `Size      : ${(file.size / 1024).toFixed(2)} KB`,
            '',
            `SHA-256   : ${hashHex}`,
            '',
            `Signer    : ${walletAddress ?? 'unknown'}`,
            `Network   : ${network ? ((network as unknown as Record<string, string>)['bech32'] === 'opt' ? 'OPNet Testnet' : 'OPNet Mainnet') : 'unknown'}`,
            `Tx ID     : ${txId}`,
            `Explorer  : ${network ? getTransactionUrl(network, txId) : explorerUrl + txId}`,
            '',
            '──────────────────────────────────────────────────────────────────',
            'This certificate proves that the document listed above was hashed',
            'in-browser and its SHA-256 fingerprint was anchored to Bitcoin L1',
            'via the OP-Sign smart contract. The file itself was never uploaded.',
            '──────────────────────────────────────────────────────────────────',
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opsign-certificate-${file.name.replace(/\.[^.]+$/, '')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [file, hashHex, txId, walletAddress, network, explorerUrl]);

    return (
        <div className="tab-content">
            <h2 className="tab-title">Sign a Document</h2>
            <p className="tab-desc">
                Your file never leaves your browser — only its SHA-256 hash is registered on
                Bitcoin L1. The hash proves the document existed at a specific block height.
            </p>

            {/* Drop zone */}
            <div
                className={`dropzone${dragOver ? ' dropzone--over' : ''}${file ? ' dropzone--has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('sign-file-input')?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('sign-file-input')?.click()}
            >
                {hashing ? (
                    <span className="dropzone__label">Computing hash…</span>
                ) : file ? (
                    <>
                        <svg className="dropzone__icon dropzone__icon--ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="dropzone__filename">{file.name}</span>
                        <span className="dropzone__size">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                ) : (
                    <>
                        <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="dropzone__label">Drop any file here, or click to browse</span>
                        <span className="dropzone__hint">PDF, Word, image — any format</span>
                    </>
                )}
                <input id="sign-file-input" type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* Hash preview */}
            {hashHex && (
                <div className="hash-display">
                    <span className="hash-display__label">SHA-256 Hash</span>
                    <code className="hash-display__value">{truncateHash(hashHex)}</code>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="alert alert--error">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 10.5a.75.75 0 100-1.5.75.75 0 000 1.5zM8 4a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 4z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Pending confirmation banner */}
            {pendingTxId && !txId && (
                <div className="pending-banner">
                    <span className="spinner" />
                    <div className="pending-banner__text">
                        <strong>Transaction submitted — waiting for confirmation…</strong>
                        <span>Your document hash is being anchored to Bitcoin L1.</span>
                    </div>
                    {network && (
                        <a
                            className="pending-banner__link"
                            href={getTransactionUrl(network, pendingTxId)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View on OPScan →
                        </a>
                    )}
                </div>
            )}

            {/* Action area */}
            {txId ? (
                <div className="success-banner">
                    <svg className="success-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <div className="success-banner__title">Document Signed on Bitcoin L1!</div>
                    <p className="success-banner__desc">
                        The hash has been permanently anchored to the blockchain.
                    </p>
                    {txId && network && (
                        <a
                            className="success-banner__link"
                            href={getTransactionUrl(network, txId)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View on OPScan →
                        </a>
                    )}
                    <div className="success-banner__actions">
                        <button className="btn-primary" onClick={downloadCertificate}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download Certificate
                        </button>
                        <button className="btn-secondary" onClick={resetState}>
                            Sign Another Document
                        </button>
                    </div>
                </div>
            ) : !connected ? (
                <button className="btn-primary" onClick={onConnect} disabled={connecting}>
                    {connecting ? 'Connecting…' : 'Connect Wallet to Sign'}
                </button>
            ) : (
                <button
                    className="btn-primary"
                    onClick={() => void handleSign()}
                    disabled={!hash || signing || !provider || !!pendingTxId}
                >
                    {signing ? (
                        <><span className="spinner" /> Waiting for Signature…</>
                    ) : pendingTxId ? (
                        <><span className="spinner" /> Confirming on-chain…</>
                    ) : (
                        'Sign Document'
                    )}
                </button>
            )}

            {!connected && hash && (
                <p className="tab-hint">Connect your OP_WALLET to sign the document on-chain.</p>
            )}
        </div>
    );
}
