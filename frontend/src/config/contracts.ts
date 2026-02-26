import { Network } from '@btc-vision/bitcoin';
import { getNetworkId } from './networks';

/**
 * Contract addresses per network.
 * Fill in the deployed address after running: node deploy.mjs
 */
const CONTRACT_ADDRESSES: Record<string, Record<string, string>> = {
    testnet: {
        opSign: 'opt1sqr4hgwx39vyjdvcqqlaqpwsuz7r6qsfrwq7esucf',
    },
    regtest: {
        opSign: '',
    },
    mainnet: {
        opSign: '',
    },
};

/**
 * Returns the contract address for a given key and network,
 * or null if not yet deployed / unsupported.
 */
export function getContractAddress(contract: string, network: Network): string | null {
    const netId = getNetworkId(network);
    const addresses = CONTRACT_ADDRESSES[netId];
    if (!addresses) return null;
    const addr = addresses[contract];
    return addr && addr.length > 0 ? addr : null;
}
