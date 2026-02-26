import { useState, useCallback } from 'react';
import { Network } from '@btc-vision/bitcoin';
import { hashDocumentToU256, formatHashHex, truncateHash } from '../utils/hashDocument';
import { useOpSignContract } from '../hooks/useOpSign';
import { DocumentRecord, truncateSigner } from '../types/DocumentRecord';
import { getBlockExplorerUrl } from '../config/networks';

interface VerifyTabProps {
    readonly network: Network | null | undefined;
}

type VerifyState =
    | { status: 'idle' }
    | { status: 'hashing' }
    | { status: 'verifying' }
    | { status: 'verified'; record: DocumentRecord }
    | { status: 'not-found' }
    | { status: 'error'; message: string };

export function VerifyTab({ network }: VerifyTabProps) {
    const contract = useOpSignContract(network);

    const [file, setFile] = useState<File | null>(null);
    const [hashHex, setHashHex] = useState('');
    const [state, setState] = useState<VerifyState>({ status: 'idle' });
    const [dragOver, setDragOver] = useState(false);

    const processAndVerify = useCallback(
        async (f: File) => {
            setFile(f);
            setHashHex('');
            setState({ status: 'hashing' });

            let hash: bigint;
            try {
                hash = await hashDocumentToU256(f);
                setHashHex(formatHashHex(hash));
            } catch {
                setState({ status: 'error', message: 'Failed to compute file hash.' });
                return;
            }

            setState({ status: 'verifying' });

            if (!contract) {
                setState({ status: 'error', message: 'Contract not available. Check network connection.' });
                return;
            }

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await contract._verifyDocument(hash) as any;

                if (result?.revert) {
                    setState({ status: 'error', message: `Query failed: ${result.revert}` });
                    return;
                }

                const props = result.properties as {
                    exists: boolean;
                    signer: bigint;
                    blockHeight: bigint;
                    revoked: boolean;
                };

                if (!props.exists) {
                    setState({ status: 'not-found' });
                    return;
                }

                const record: DocumentRecord = {
                    signer: props.signer ?? 0n,
                    blockHeight: props.blockHeight ?? 0n,
                    revoked: props.revoked ?? false,
                };

                setState({ status: 'verified', record });
            } catch (err: unknown) {
                setState({ status: 'error', message: err instanceof Error ? err.message : 'Verification failed' });
            }
        },
        [contract],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void processAndVerify(f);
        },
        [processAndVerify],
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) void processAndVerify(f);
    };

    const isLoading = state.status === 'hashing' || state.status === 'verifying';

    return (
        <div className="tab-content">
            <h2 className="tab-title">Verify a Document</h2>
            <p className="tab-desc">
                Upload a file to check whether its hash has been notarised on Bitcoin L1.
                No wallet required — this is a read-only query.
            </p>

            {/* Drop zone */}
            <div
                className={`dropzone${dragOver ? ' dropzone--over' : ''}${file ? ' dropzone--has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('verify-file-input')?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('verify-file-input')?.click()}
            >
                {isLoading ? (
                    <>
                        <span className="spinner" />
                        <span className="dropzone__label">{state.status === 'hashing' ? 'Computing hash…' : 'Querying blockchain…'}</span>
                    </>
                ) : file ? (
                    <>
                        <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="dropzone__filename">{file.name}</span>
                        <span className="dropzone__size">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                ) : (
                    <>
                        <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span className="dropzone__label">Drop a file here, or click to browse</span>
                        <span className="dropzone__hint">Any format — must be the original unmodified file</span>
                    </>
                )}
                <input id="verify-file-input" type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* Hash preview */}
            {hashHex && !isLoading && (
                <div className="hash-display">
                    <span className="hash-display__label">SHA-256 Hash</span>
                    <code className="hash-display__value">{truncateHash(hashHex)}</code>
                </div>
            )}

            {/* Result: verified active */}
            {state.status === 'verified' && !state.record.revoked && (
                <div className="verify-result verify-result--verified">
                    <div className="verify-result__header">
                        <svg className="verify-result__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="9 12 11 14 15 10" />
                        </svg>
                        <div className="verify-result__title">Document Verified</div>
                    </div>
                    <div className="verify-result__rows">
                        <div className="verify-result__row">
                            <span className="verify-result__key">Signer</span>
                            <code className="verify-result__val">{truncateSigner(state.record.signer)}</code>
                        </div>
                        <div className="verify-result__row">
                            <span className="verify-result__key">Block Height</span>
                            <code className="verify-result__val">#{state.record.blockHeight.toString()}</code>
                        </div>
                        {network && (
                            <div className="verify-result__row">
                                <span className="verify-result__key">Explorer</span>
                                <a
                                    className="verify-result__link"
                                    href={getBlockExplorerUrl(network, state.record.blockHeight)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View Block #{state.record.blockHeight.toString()} →
                                </a>
                            </div>
                        )}
                        <div className="verify-result__row">
                            <span className="verify-result__key">Status</span>
                            <span className="badge badge--active">ACTIVE</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Result: revoked */}
            {state.status === 'verified' && state.record.revoked && (
                <div className="verify-result verify-result--revoked">
                    <div className="verify-result__header">
                        <svg className="verify-result__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div className="verify-result__title">Document Revoked</div>
                    </div>
                    <div className="verify-result__rows">
                        <div className="verify-result__row">
                            <span className="verify-result__key">Original Signer</span>
                            <code className="verify-result__val">{truncateSigner(state.record.signer)}</code>
                        </div>
                        <div className="verify-result__row">
                            <span className="verify-result__key">Signed at Block</span>
                            <code className="verify-result__val">#{state.record.blockHeight.toString()}</code>
                        </div>
                        {network && (
                            <div className="verify-result__row">
                                <span className="verify-result__key">Explorer</span>
                                <a
                                    className="verify-result__link"
                                    href={getBlockExplorerUrl(network, state.record.blockHeight)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View Block #{state.record.blockHeight.toString()} →
                                </a>
                            </div>
                        )}
                        <div className="verify-result__row">
                            <span className="verify-result__key">Status</span>
                            <span className="badge badge--revoked">REVOKED</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Result: not found */}
            {state.status === 'not-found' && (
                <div className="verify-result verify-result--not-found">
                    <div className="verify-result__header">
                        <svg className="verify-result__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        <div className="verify-result__title">Not Found</div>
                    </div>
                    <p className="verify-result__desc">
                        No record found for this document. Either it was never signed on-chain,
                        or this is not the original unmodified file.
                    </p>
                </div>
            )}

            {/* Error */}
            {state.status === 'error' && (
                <div className="alert alert--error">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 10.5a.75.75 0 100-1.5.75.75 0 000 1.5zM8 4a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 4z" />
                    </svg>
                    {state.message}
                </div>
            )}

            {file && !isLoading && state.status !== 'idle' && (
                <button
                    className="btn-secondary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => { setFile(null); setHashHex(''); setState({ status: 'idle' }); }}
                >
                    Verify Another File
                </button>
            )}
        </div>
    );
}
