import { describe, it, expect } from 'vitest';
import { getContractAddress } from './contracts';

describe('getContractAddress', () => {
    const testnetObj = { network: 'testnet' };
    const mainnetObj = { network: 'mainnet' };
    const regtestObj = { network: 'regtest' };
    const unknownObj = { network: 'polkadot' };

    it('returns null for an undeployed testnet contract', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getContractAddress('opSign', testnetObj as any)).toBeNull();
    });

    it('returns null for an undeployed mainnet contract', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getContractAddress('opSign', mainnetObj as any)).toBeNull();
    });

    it('returns null for an undeployed regtest contract', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getContractAddress('opSign', regtestObj as any)).toBeNull();
    });

    it('returns null for an unknown contract key', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getContractAddress('nonExistent', testnetObj as any)).toBeNull();
    });

    it('returns null for an unknown network', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getContractAddress('opSign', unknownObj as any)).toBeNull();
    });
});
