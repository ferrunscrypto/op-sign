import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the _signDocument function call.
 */
export type signDocument = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the _revokeDocument function call.
 */
export type revokeDocument = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the _verifyDocument function call.
 */
export type verifyDocument = CallResult<
    {
        exists: boolean;
        signer: bigint;
        blockHeight: bigint;
        revoked: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the _getDocCount function call.
 */
export type getDocCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the _getSignerDocCount function call.
 */
export type getSignerDocCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IOpSign
// ------------------------------------------------------------------
export interface IOpSign extends IOP_NETContract {
    _signDocument(hash: bigint): Promise<signDocument>;
    _revokeDocument(hash: bigint): Promise<revokeDocument>;
    _verifyDocument(hash: bigint): Promise<verifyDocument>;
    _getDocCount(): Promise<getDocCount>;
    _getSignerDocCount(signer: Address): Promise<getSignerDocCount>;
}
