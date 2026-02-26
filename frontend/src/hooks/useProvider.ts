import { useMemo } from 'react';
import { JSONRpcProvider } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { getRpcUrl } from '../config/networks';

const providerCache = new Map<string, JSONRpcProvider>();

export function useProvider(network: Network | null | undefined): JSONRpcProvider | null {
    return useMemo(() => {
        if (!network) return null;

        try {
            const rpcUrl = getRpcUrl(network);

            if (!providerCache.has(rpcUrl)) {
                const provider = new JSONRpcProvider({ url: rpcUrl, network });
                providerCache.set(rpcUrl, provider);
            }

            return providerCache.get(rpcUrl)!;
        } catch {
            return null;
        }
    }, [network]);
}
