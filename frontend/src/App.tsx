import { useState } from 'react';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { SignTab } from './components/SignTab';
import { VerifyTab } from './components/VerifyTab';
import { StatsBar } from './components/StatsBar';
import { MyDocumentsTab } from './components/MyDocumentsTab';
import { getContractAddress } from './config/contracts';

type Tab = 'sign' | 'verify' | 'mydocs' | 'stats';

export function App() {
    const { network, walletAddress, connectToWallet, connecting, disconnect } = useWalletConnect();
    const [tab, setTab] = useState<Tab>('sign');

    const connected = Boolean(network && walletAddress);
    const contractDeployed = Boolean(network && getContractAddress('opSign', network));

    const truncatedAddress = walletAddress
        ? `${walletAddress.slice(0, 10)}…${walletAddress.slice(-6)}`
        : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const networkLabel = (network as any)?.bech32 === 'opt' ? 'Testnet' : (network as any)?.bech32 === 'bc' ? 'Mainnet' : 'Regtest';

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <div className="header__brand">
                    <div className="header__logo">
                        <svg viewBox="0 0 32 32" fill="none">
                            <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#f7931a" strokeWidth="2" />
                            <path d="M10 16l4 4 8-8" stroke="#f7931a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div className="header__text">
                        <span className="header__name">OP-Sign</span>
                        <span className="header__tagline">Decentralized Document Notary</span>
                    </div>
                </div>

                <div className="header__actions">
                    {connected ? (
                        <div className="wallet-chip">
                            <span className="wallet-chip__dot" />
                            <span className="wallet-chip__addr">{truncatedAddress}</span>
                            <span className="wallet-chip__net">{networkLabel}</span>
                            <button className="wallet-chip__disconnect" onClick={disconnect} title="Disconnect wallet">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            className="btn-connect"
                            onClick={() => connectToWallet(SupportedWallets.OP_WALLET)}
                            disabled={connecting}
                        >
                            {connecting ? 'Connecting…' : 'Connect Wallet'}
                        </button>
                    )}
                </div>
            </header>

            {/* Contract not deployed warning */}
            {connected && !contractDeployed && (
                <div className="banner banner--warn">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6.5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                    </svg>
                    Contract not yet deployed on this network. Sign and verify are unavailable.
                </div>
            )}

            {/* Tab navigation */}
            <nav className="tabs">
                <button
                    className={`tab${tab === 'sign' ? ' tab--active' : ''}`}
                    onClick={() => setTab('sign')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Sign
                </button>
                <button
                    className={`tab${tab === 'verify' ? ' tab--active' : ''}`}
                    onClick={() => setTab('verify')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Verify
                </button>
                <button
                    className={`tab${tab === 'mydocs' ? ' tab--active' : ''}`}
                    onClick={() => setTab('mydocs')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                    My Docs
                </button>
                <button
                    className={`tab${tab === 'stats' ? ' tab--active' : ''}`}
                    onClick={() => setTab('stats')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Stats
                </button>
            </nav>

            {/* Main content */}
            <main className="main">
                {tab === 'sign' && (
                    <SignTab
                        network={network}
                        walletAddress={walletAddress}
                        connected={connected}
                        onConnect={() => connectToWallet(SupportedWallets.OP_WALLET)}
                        connecting={connecting}
                    />
                )}
                {tab === 'verify' && <VerifyTab network={network} />}
                {tab === 'mydocs' && (
                    <MyDocumentsTab
                        network={network}
                        walletAddress={walletAddress}
                        connected={connected}
                        onConnect={() => connectToWallet(SupportedWallets.OP_WALLET)}
                        connecting={connecting}
                    />
                )}
                {tab === 'stats' && <StatsBar network={network} walletAddress={walletAddress} />}
            </main>

            {/* Footer */}
            <footer className="footer">
                OP-Sign &mdash; Trustless Document Notary on Bitcoin L1 &nbsp;&bull;&nbsp;
                Powered by <span className="footer__opnet">OPNet</span>
            </footer>
        </div>
    );
}
