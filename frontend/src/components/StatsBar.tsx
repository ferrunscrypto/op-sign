import { useState, useEffect, useCallback } from 'react';
import { Network } from '@btc-vision/bitcoin';
import { useOpSignContract } from '../hooks/useOpSign';
import { useProvider } from '../hooks/useProvider';
import { resolveAddress } from '../utils/resolveAddress';

interface StatsBarProps {
    readonly network: Network | null | undefined;
    readonly walletAddress: string | null | undefined;
}

export function StatsBar({ network, walletAddress }: StatsBarProps) {
    const contract = useOpSignContract(network);
    const provider = useProvider(network);

    const [totalDocs, setTotalDocs] = useState<bigint | null>(null);
    const [loadingTotal, setLoadingTotal] = useState(false);

    const [signerInput, setSignerInput] = useState('');
    const [signerCount, setSignerCount] = useState<bigint | null>(null);
    const [signerError, setSignerError] = useState('');
    const [loadingSigner, setLoadingSigner] = useState(false);

    // Fetch total doc count on mount / network change
    useEffect(() => {
        if (!contract) return;
        setLoadingTotal(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (contract._getDocCount() as Promise<any>)
            .then((result: any) => {
                if (result?.properties?.count !== undefined) {
                    setTotalDocs(result.properties.count as bigint);
                }
            })
            .catch(() => {/* silent */})
            .finally(() => setLoadingTotal(false));
    }, [contract]);

    // Pre-fill the lookup with the connected wallet address
    useEffect(() => {
        if (walletAddress && typeof walletAddress === 'string') {
            setSignerInput(walletAddress);
        }
    }, [walletAddress]);

    const handleLookup = useCallback(async () => {
        const addr = signerInput.trim();
        if (!contract || !addr || !provider) return;

        setLoadingSigner(true);
        setSignerError('');
        setSignerCount(null);

        try {
            const resolved = await resolveAddress(addr, provider);
            if (!resolved) {
                setSignerError('Could not resolve address. Make sure it is a valid OPNet address.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await contract._getSignerDocCount(resolved) as any;

            if (result?.revert) {
                setSignerError(`Query failed: ${result.revert}`);
                return;
            }

            if (result?.properties?.count !== undefined) {
                setSignerCount(result.properties.count as bigint);
            } else {
                setSignerError('Unexpected response from contract.');
            }
        } catch (err: unknown) {
            setSignerError(err instanceof Error ? err.message : 'Lookup failed');
        } finally {
            setLoadingSigner(false);
        }
    }, [contract, signerInput, provider]);

    return (
        <div className="tab-content">
            <h2 className="tab-title">Platform Stats</h2>

            {/* Global stat */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card__label">Total Documents Notarised</div>
                    <div className="stat-card__value">
                        {loadingTotal ? (
                            <span className="spinner" />
                        ) : totalDocs !== null ? (
                            totalDocs.toString()
                        ) : (
                            '—'
                        )}
                    </div>
                    <div className="stat-card__sub">Platform-wide, all time</div>
                </div>
            </div>

            {/* Signer profile lookup */}
            <div className="signer-lookup">
                <h3 className="signer-lookup__title">Signer Profile</h3>
                <p className="signer-lookup__desc">
                    Enter any OPNet address to see how many documents they have signed.
                </p>

                <div className="signer-lookup__row">
                    <input
                        className="signer-lookup__input"
                        type="text"
                        placeholder="opt1p… address"
                        value={signerInput}
                        onChange={(e) => { setSignerInput(e.target.value); setSignerCount(null); setSignerError(''); }}
                        spellCheck={false}
                        onKeyDown={(e) => e.key === 'Enter' && void handleLookup()}
                    />
                    <button
                        className="btn-primary"
                        onClick={() => void handleLookup()}
                        disabled={!contract || !provider || !signerInput.trim() || loadingSigner}
                    >
                        {loadingSigner ? <><span className="spinner" /> Fetching…</> : 'Lookup'}
                    </button>
                </div>

                {signerError && (
                    <div className="alert alert--error" style={{ marginTop: '0.75rem' }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 10.5a.75.75 0 100-1.5.75.75 0 000 1.5zM8 4a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 4z" />
                        </svg>
                        {signerError}
                    </div>
                )}

                {signerCount !== null && !signerError && (
                    <div className="stat-card" style={{ marginTop: '1rem' }}>
                        <div className="stat-card__label">
                            Documents signed by {signerInput.slice(0, 14)}…
                        </div>
                        <div className="stat-card__value">{signerCount.toString()}</div>
                        <div className="stat-card__sub">
                            {signerCount === 0n ? 'No documents on record' : signerCount === 1n ? '1 document notarised' : `${signerCount} documents notarised`}
                        </div>
                    </div>
                )}
            </div>

            <div className="stats-info">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 2.75A.75.75 0 008 5.25v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 3.75zm0 7.5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                </svg>
                Stats are read directly from the OPNet smart contract with no intermediary.
            </div>
        </div>
    );
}
