import { useMemo } from 'react';
import { getContract } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { useProvider } from './useProvider';
import { OpSignAbi } from '../abi/OpSignABI';
import { getContractAddress } from '../config/contracts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

/**
 * Returns a typed OpSign contract instance for the given network.
 *
 * Pass `from` (the wallet's resolved Address) for write simulations so
 * the contract sees the correct tx.sender. Omit `from` for read-only calls.
 */
export function useOpSignContract(
    network: Network | null | undefined,
    from?: Address,
): AnyContract | null {
    const provider = useProvider(network);

    return useMemo(() => {
        if (!network || !provider) return null;

        const address = getContractAddress('opSign', network);
        if (!address) return null;

        return getContract<AnyContract>(
            address,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            OpSignAbi as any,
            provider,
            network,
            from,
        );
    }, [network, provider, from]);
}
