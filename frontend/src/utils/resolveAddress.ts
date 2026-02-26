import { JSONRpcProvider } from 'opnet';
import { Address } from '@btc-vision/transaction';

/**
 * Resolve a bech32 address string to a btc-vision Address object.
 * Uses getPublicKeysInfoRaw — the same method used by Eternal Sentinel.
 */
export async function resolveAddress(
    bech32: string,
    provider: JSONRpcProvider,
): Promise<Address | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (provider as any).getPublicKeysInfoRaw(bech32);
        const keys = Object.keys(result ?? {});
        const firstKey = keys[0];
        if (!firstKey) return null;
        const info = result[bech32] ?? result[firstKey];
        if (!info || 'error' in info) return null;
        const primaryKey = info.mldsaHashedPublicKey ?? info.tweakedPubkey;
        if (!primaryKey) return null;
        const legacyKey = info.originalPubKey ?? info.tweakedPubkey;
        return Address.fromString(primaryKey, legacyKey);
    } catch {
        return null;
    }
}
