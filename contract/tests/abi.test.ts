import { describe, it, expect } from 'vitest';
import { OpSignAbi } from '../abis/OpSign.abi';

describe('OpSign ABI', () => {
    it('exports an array', () => {
        expect(Array.isArray(OpSignAbi)).toBe(true);
    });

    const getMethod = (name: string) => OpSignAbi.find((e) => e.name === name);

    describe('_signDocument', () => {
        it('exists', () => {
            expect(getMethod('_signDocument')).toBeDefined();
        });

        it('has one input: hash (UINT256)', () => {
            const m = getMethod('_signDocument')!;
            expect(m.inputs).toHaveLength(1);
            expect(m.inputs[0].name).toBe('hash');
        });

        it('has no outputs', () => {
            const m = getMethod('_signDocument')!;
            expect(m.outputs).toHaveLength(0);
        });
    });

    describe('_revokeDocument', () => {
        it('exists', () => {
            expect(getMethod('_revokeDocument')).toBeDefined();
        });

        it('has one input: hash (UINT256)', () => {
            const m = getMethod('_revokeDocument')!;
            expect(m.inputs).toHaveLength(1);
            expect(m.inputs[0].name).toBe('hash');
        });

        it('has no outputs', () => {
            const m = getMethod('_revokeDocument')!;
            expect(m.outputs).toHaveLength(0);
        });
    });

    describe('_verifyDocument', () => {
        it('exists', () => {
            expect(getMethod('_verifyDocument')).toBeDefined();
        });

        it('has one input: hash', () => {
            const m = getMethod('_verifyDocument')!;
            expect(m.inputs).toHaveLength(1);
            expect(m.inputs[0].name).toBe('hash');
        });

        it('has four outputs: exists, signer, blockHeight, revoked', () => {
            const m = getMethod('_verifyDocument')!;
            expect(m.outputs).toHaveLength(4);
            const names = m.outputs.map((o: { name: string }) => o.name);
            expect(names).toContain('exists');
            expect(names).toContain('signer');
            expect(names).toContain('blockHeight');
            expect(names).toContain('revoked');
        });

        it('exists output is first', () => {
            const m = getMethod('_verifyDocument')!;
            expect(m.outputs[0].name).toBe('exists');
        });
    });

    describe('_getDocCount', () => {
        it('exists', () => {
            expect(getMethod('_getDocCount')).toBeDefined();
        });

        it('has no inputs', () => {
            const m = getMethod('_getDocCount')!;
            expect(m.inputs).toHaveLength(0);
        });

        it('has one output: count', () => {
            const m = getMethod('_getDocCount')!;
            expect(m.outputs).toHaveLength(1);
            expect(m.outputs[0].name).toBe('count');
        });
    });

    describe('_getSignerDocCount', () => {
        it('exists', () => {
            expect(getMethod('_getSignerDocCount')).toBeDefined();
        });

        it('has one input: signer', () => {
            const m = getMethod('_getSignerDocCount')!;
            expect(m.inputs).toHaveLength(1);
            expect(m.inputs[0].name).toBe('signer');
        });

        it('has one output: count', () => {
            const m = getMethod('_getSignerDocCount')!;
            expect(m.outputs).toHaveLength(1);
            expect(m.outputs[0].name).toBe('count');
        });
    });

    it('includes OP_NET_ABI entries', () => {
        // OP_NET_ABI spreads into the array, so there should be more than 5 entries
        expect(OpSignAbi.length).toBeGreaterThan(5);
    });

    it('all methods have unique names', () => {
        const names = OpSignAbi.map((e) => e.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });
});
