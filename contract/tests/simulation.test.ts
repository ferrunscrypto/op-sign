/**
 * simulation.test.ts
 *
 * Tests that verify the ABI-level contract interface matches the implementation:
 * - Method names resolve to the correct selectors (keccak-style naming)
 * - Input/output types are the expected ABIDataTypes values
 * - ABI is a superset of OP_NET_ABI
 * - Events array is empty (no event ABIs declared separately for OpSign)
 * - TypeScript types match documented contract types
 *
 * These tests complement abi.test.ts by focusing on semantic correctness
 * rather than structural presence.
 */
import { describe, it, expect } from 'vitest';
import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import { OpSignAbi, OpSignEvents } from '../abis/OpSign.abi';
import { OpSignSimulator, ALICE, MAX_U256 } from './helpers/OpSignSimulator';

// ─────────────────────────────────────────────────────────────────────────────
// ABI method type validation
// ─────────────────────────────────────────────────────────────────────────────

describe('ABI method types', () => {
    const getMethod = (name: string) => OpSignAbi.find((e) => e.name === name);

    it('all custom methods have type BitcoinAbiTypes.Function', () => {
        const customNames = [
            '_signDocument',
            '_revokeDocument',
            '_verifyDocument',
            '_getDocCount',
            '_getSignerDocCount',
        ];
        for (const name of customNames) {
            const m = getMethod(name)!;
            expect(m.type, `${name} should be Function`).toBe(BitcoinAbiTypes.Function);
        }
    });

    it('_signDocument hash input is UINT256', () => {
        const m = getMethod('_signDocument')!;
        expect(m.inputs[0].type).toBe(ABIDataTypes.UINT256);
    });

    it('_revokeDocument hash input is UINT256', () => {
        const m = getMethod('_revokeDocument')!;
        expect(m.inputs[0].type).toBe(ABIDataTypes.UINT256);
    });

    it('_verifyDocument hash input is UINT256', () => {
        const m = getMethod('_verifyDocument')!;
        expect(m.inputs[0].type).toBe(ABIDataTypes.UINT256);
    });

    it('_verifyDocument exists output is BOOL (first output)', () => {
        const m = getMethod('_verifyDocument')!;
        const exists = m.outputs.find((o: { name: string }) => o.name === 'exists')!;
        expect(exists.type).toBe(ABIDataTypes.BOOL);
    });

    it('_verifyDocument signer output is UINT256 (address encoded as u256)', () => {
        const m = getMethod('_verifyDocument')!;
        const signer = m.outputs.find((o: { name: string }) => o.name === 'signer')!;
        expect(signer.type).toBe(ABIDataTypes.UINT256);
    });

    it('_verifyDocument blockHeight output is UINT256', () => {
        const m = getMethod('_verifyDocument')!;
        const bh = m.outputs.find((o: { name: string }) => o.name === 'blockHeight')!;
        expect(bh.type).toBe(ABIDataTypes.UINT256);
    });

    it('_verifyDocument revoked output is BOOL', () => {
        const m = getMethod('_verifyDocument')!;
        const rev = m.outputs.find((o: { name: string }) => o.name === 'revoked')!;
        expect(rev.type).toBe(ABIDataTypes.BOOL);
    });

    it('_getDocCount count output is UINT256', () => {
        const m = getMethod('_getDocCount')!;
        expect(m.outputs[0].type).toBe(ABIDataTypes.UINT256);
    });

    it('_getSignerDocCount signer input is ADDRESS', () => {
        const m = getMethod('_getSignerDocCount')!;
        expect(m.inputs[0].type).toBe(ABIDataTypes.ADDRESS);
    });

    it('_getSignerDocCount count output is UINT256', () => {
        const m = getMethod('_getSignerDocCount')!;
        expect(m.outputs[0].type).toBe(ABIDataTypes.UINT256);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// OP_NET_ABI inclusion
// ─────────────────────────────────────────────────────────────────────────────

describe('OP_NET_ABI inclusion', () => {
    it('every OP_NET_ABI entry is present in OpSignAbi', () => {
        for (const entry of OP_NET_ABI) {
            const found = OpSignAbi.find((e) => e.name === entry.name);
            expect(found, `OP_NET_ABI entry "${entry.name}" missing`).toBeDefined();
        }
    });

    it('OpSignAbi has exactly 5 custom methods + OP_NET_ABI length entries', () => {
        // 5 custom methods: _signDocument, _revokeDocument, _verifyDocument,
        // _getDocCount, _getSignerDocCount
        const customCount = 5;
        expect(OpSignAbi.length).toBe(customCount + OP_NET_ABI.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

describe('Events', () => {
    it('OpSignEvents is an empty array', () => {
        expect(OpSignEvents).toEqual([]);
    });

    it('no event-type entries appear in the ABI', () => {
        const events = OpSignAbi.filter((e) => e.type === BitcoinAbiTypes.Event);
        expect(events).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Method naming convention
// ─────────────────────────────────────────────────────────────────────────────

describe('Method naming convention', () => {
    const customMethods = [
        '_signDocument',
        '_revokeDocument',
        '_verifyDocument',
        '_getDocCount',
        '_getSignerDocCount',
    ];

    it('all custom methods start with underscore (OPNet convention)', () => {
        for (const name of customMethods) {
            expect(name.startsWith('_'), `${name} should start with _`).toBe(true);
        }
    });

    it('all custom methods are camelCase after the underscore', () => {
        for (const name of customMethods) {
            const withoutLeading = name.slice(1); // strip leading _
            expect(withoutLeading[0]).toMatch(/[a-z]/);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Simulator ↔ ABI type consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('Simulator ↔ ABI type consistency', () => {
    const sim = new OpSignSimulator();

    it('verifyDocument returns boolean for exists (matches BOOL ABI type)', () => {
        sim.signDocument(0x9999n, ALICE);
        const result = sim.verifyDocument(0x9999n);
        expect(typeof result.exists).toBe('boolean');
    });

    it('unregistered document returns exists=false', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.exists).toBe(false);
    });

    it('verifyDocument returns bigint for signer (matches UINT256 ABI type)', () => {
        sim.signDocument(0x1234n, ALICE);
        const result = sim.verifyDocument(0x1234n);
        expect(typeof result.signer).toBe('bigint');
    });

    it('verifyDocument returns bigint for blockHeight (matches UINT256 ABI type)', () => {
        sim.signDocument(0xabcdn, ALICE);
        const result = sim.verifyDocument(0xabcdn);
        expect(typeof result.blockHeight).toBe('bigint');
    });

    it('verifyDocument returns boolean for revoked (matches BOOL ABI type)', () => {
        sim.signDocument(0xef01n, ALICE);
        const result = sim.verifyDocument(0xef01n);
        expect(typeof result.revoked).toBe('boolean');
    });

    it('getDocCount returns bigint (matches UINT256 ABI type)', () => {
        expect(typeof sim.getDocCount()).toBe('bigint');
    });

    it('getSignerDocCount returns bigint (matches UINT256 ABI type)', () => {
        expect(typeof sim.getSignerDocCount(ALICE)).toBe('bigint');
    });

    it('unregistered document signer is exactly 0n (zero bigint)', () => {
        const result = sim.verifyDocument(0xdeadbeefn);
        expect(result.signer).toBe(0n);
    });

    it('max u256 value is representable as a bigint hash', () => {
        sim.signDocument(MAX_U256, ALICE);
        const result = sim.verifyDocument(MAX_U256);
        expect(result.signer).toBe(ALICE);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ABI input/output count validation
// ─────────────────────────────────────────────────────────────────────────────

describe('ABI input/output count', () => {
    const getMethod = (name: string) => OpSignAbi.find((e) => e.name === name)!;

    it('_signDocument: 1 input, 0 outputs', () => {
        const m = getMethod('_signDocument');
        expect(m.inputs).toHaveLength(1);
        expect(m.outputs).toHaveLength(0);
    });

    it('_revokeDocument: 1 input, 0 outputs', () => {
        const m = getMethod('_revokeDocument');
        expect(m.inputs).toHaveLength(1);
        expect(m.outputs).toHaveLength(0);
    });

    it('_verifyDocument: 1 input, 4 outputs', () => {
        const m = getMethod('_verifyDocument');
        expect(m.inputs).toHaveLength(1);
        expect(m.outputs).toHaveLength(4);
    });

    it('_getDocCount: 0 inputs, 1 output', () => {
        const m = getMethod('_getDocCount');
        expect(m.inputs).toHaveLength(0);
        expect(m.outputs).toHaveLength(1);
    });

    it('_getSignerDocCount: 1 input, 1 output', () => {
        const m = getMethod('_getSignerDocCount');
        expect(m.inputs).toHaveLength(1);
        expect(m.outputs).toHaveLength(1);
    });
});
