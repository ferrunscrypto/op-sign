import { describe, it, expect } from 'vitest';
import {
    getNetworkId,
    getNetworkName,
    getRpcUrl,
    getExplorerUrl,
    NETWORK_CONFIGS,
} from './networks';

// ─────────────────────────────────────────────────────────────────────────────
// getNetworkId — via .network string
// ─────────────────────────────────────────────────────────────────────────────

describe('getNetworkId via .network string', () => {
    it('returns "mainnet" for "mainnet"', () => {
        expect(getNetworkId({ network: 'mainnet' })).toBe('mainnet');
    });

    it('returns "mainnet" for "livenet"', () => {
        expect(getNetworkId({ network: 'livenet' })).toBe('mainnet');
    });

    it('returns "mainnet" for "bitcoin"', () => {
        expect(getNetworkId({ network: 'bitcoin' })).toBe('mainnet');
    });

    it('returns "testnet" for "testnet"', () => {
        expect(getNetworkId({ network: 'testnet' })).toBe('testnet');
    });

    it('returns "testnet" for "signet"', () => {
        expect(getNetworkId({ network: 'signet' })).toBe('testnet');
    });

    it('returns "regtest" for "regtest"', () => {
        expect(getNetworkId({ network: 'regtest' })).toBe('regtest');
    });

    it('is case-insensitive for .network', () => {
        expect(getNetworkId({ network: 'MAINNET' })).toBe('mainnet');
        expect(getNetworkId({ network: 'TestNet' })).toBe('testnet');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNetworkId — via .bech32 prefix
// ─────────────────────────────────────────────────────────────────────────────

describe('getNetworkId via .bech32 prefix', () => {
    it('returns "mainnet" for bech32 "bc"', () => {
        expect(getNetworkId({ bech32: 'bc' })).toBe('mainnet');
    });

    it('returns "testnet" for bech32 "opt"', () => {
        expect(getNetworkId({ bech32: 'opt' })).toBe('testnet');
    });

    it('returns "testnet" for bech32 "tb"', () => {
        expect(getNetworkId({ bech32: 'tb' })).toBe('testnet');
    });

    it('returns "regtest" for bech32 "bcrt"', () => {
        expect(getNetworkId({ bech32: 'bcrt' })).toBe('regtest');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNetworkId — via .chainType
// ─────────────────────────────────────────────────────────────────────────────

describe('getNetworkId via .chainType', () => {
    it('returns "mainnet" for chainType containing "mainnet"', () => {
        expect(getNetworkId({ chainType: 'BitcoinMainnet' })).toBe('mainnet');
    });

    it('returns "testnet" for chainType containing "testnet"', () => {
        expect(getNetworkId({ chainType: 'OPNetTestnet' })).toBe('testnet');
    });

    it('returns "regtest" for chainType containing "regtest"', () => {
        expect(getNetworkId({ chainType: 'BitcoinRegtest' })).toBe('regtest');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNetworkId — null / unknown
// ─────────────────────────────────────────────────────────────────────────────

describe('getNetworkId edge cases', () => {
    it('returns "unknown" for null', () => {
        expect(getNetworkId(null)).toBe('unknown');
    });

    it('returns "unknown" for undefined', () => {
        expect(getNetworkId(undefined)).toBe('unknown');
    });

    it('returns "unknown" for empty object', () => {
        expect(getNetworkId({})).toBe('unknown');
    });

    it('returns "unknown" for unrecognised network string', () => {
        expect(getNetworkId({ network: 'polkadot' })).toBe('unknown');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNetworkName
// ─────────────────────────────────────────────────────────────────────────────

describe('getNetworkName', () => {
    it('returns "Mainnet" for mainnet object', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getNetworkName({ network: 'mainnet' } as any)).toBe('Mainnet');
    });

    it('returns "OPNet Testnet" for testnet object', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getNetworkName({ network: 'testnet' } as any)).toBe('OPNet Testnet');
    });

    it('returns "Regtest" for regtest object', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getNetworkName({ network: 'regtest' } as any)).toBe('Regtest');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRpcUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('getRpcUrl', () => {
    it('returns testnet RPC URL', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = getRpcUrl({ network: 'testnet' } as any);
        expect(url).toBe('https://testnet.opnet.org');
    });

    it('returns mainnet RPC URL', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = getRpcUrl({ network: 'mainnet' } as any);
        expect(url).toBe('https://mainnet.opnet.org');
    });

    it('throws for an unsupported network', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => getRpcUrl({ network: 'polkadot' } as any)).toThrow('Unsupported network');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getExplorerUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('getExplorerUrl', () => {
    it('returns testnet explorer URL', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = getExplorerUrl({ network: 'testnet' } as any);
        expect(url).toBe('https://mempool.opnet.org/testnet4/tx/');
    });

    it('falls back to testnet explorer for unknown network', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = getExplorerUrl({ network: 'polkadot' } as any);
        expect(url).toBe('https://mempool.opnet.org/testnet4/tx/');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK_CONFIGS completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('NETWORK_CONFIGS', () => {
    it('has entries for mainnet, testnet, regtest', () => {
        expect(NETWORK_CONFIGS.has('mainnet')).toBe(true);
        expect(NETWORK_CONFIGS.has('testnet')).toBe(true);
        expect(NETWORK_CONFIGS.has('regtest')).toBe(true);
    });

    it('every config has name, rpcUrl, explorerUrl', () => {
        for (const [, config] of NETWORK_CONFIGS) {
            expect(config.name).toBeTruthy();
            expect(config.rpcUrl).toMatch(/^https?:\/\//);
            expect(config.explorerUrl).toMatch(/^https?:\/\//);
        }
    });
});
