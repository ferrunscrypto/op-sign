import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const OpSignEvents = [];

export const OpSignAbi = [
    {
        name: '_signDocument',
        inputs: [{ name: 'hash', type: ABIDataTypes.UINT256 }],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: '_revokeDocument',
        inputs: [{ name: 'hash', type: ABIDataTypes.UINT256 }],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: '_verifyDocument',
        inputs: [{ name: 'hash', type: ABIDataTypes.UINT256 }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'signer', type: ABIDataTypes.UINT256 },
            { name: 'blockHeight', type: ABIDataTypes.UINT256 },
            { name: 'revoked', type: ABIDataTypes.BOOL },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: '_getDocCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: '_getSignerDocCount',
        inputs: [{ name: 'signer', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...OpSignEvents,
    ...OP_NET_ABI,
];

export default OpSignAbi;
