import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerifyTab } from './VerifyTab';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../hooks/useOpSign', () => ({
    useOpSignContract: vi.fn(),
}));

vi.mock('../utils/hashDocument', () => ({
    hashDocumentToU256: vi.fn(),
    formatHashHex: (h: bigint) => '0x' + h.toString(16).padStart(64, '0'),
    truncateHash: (h: string) => h.slice(0, 10) + '…' + h.slice(-6),
}));

import { useOpSignContract } from '../hooks/useOpSign';
import { hashDocumentToU256 } from '../utils/hashDocument';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'doc.pdf'): File {
    return new File([new Uint8Array(32)], name, { type: 'application/pdf' });
}

const ALICE_SIGNER = BigInt('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');

const mockContract = {
    _verifyDocument: vi.fn(),
};

const defaultProps = {
    network: { network: 'testnet' } as never,
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOpSignContract).mockReturnValue(mockContract as never);
    vi.mocked(hashDocumentToU256).mockResolvedValue(0x1234n);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VerifyTab', () => {
    describe('initial render', () => {
        it('shows the Verify a Document heading', () => {
            render(<VerifyTab {...defaultProps} />);
            expect(screen.getByText('Verify a Document')).toBeInTheDocument();
        });

        it('shows the drop zone in idle state', () => {
            render(<VerifyTab {...defaultProps} />);
            expect(screen.getByText(/Drop a file here/i)).toBeInTheDocument();
        });

        it('does not show a result panel initially', () => {
            render(<VerifyTab {...defaultProps} />);
            expect(screen.queryByText('Document Verified')).not.toBeInTheDocument();
            expect(screen.queryByText('Document Revoked')).not.toBeInTheDocument();
            expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
        });
    });

    describe('verified active document', () => {
        beforeEach(() => {
            mockContract._verifyDocument.mockResolvedValue({
                revert: undefined,
                properties: {
                    exists: true,
                    signer: ALICE_SIGNER,
                    blockHeight: 800000n,
                    revoked: false,
                },
            });
        });

        it('shows Document Verified banner', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('Document Verified')).toBeInTheDocument();
            });
        });

        it('shows block height in result', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('#800000')).toBeInTheDocument();
            });
        });

        it('shows ACTIVE badge', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('ACTIVE')).toBeInTheDocument();
            });
        });

        it('shows hash preview', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('SHA-256 Hash')).toBeInTheDocument();
            });
        });
    });

    describe('revoked document', () => {
        beforeEach(() => {
            mockContract._verifyDocument.mockResolvedValue({
                revert: undefined,
                properties: {
                    exists: true,
                    signer: ALICE_SIGNER,
                    blockHeight: 750000n,
                    revoked: true,
                },
            });
        });

        it('shows Document Revoked banner', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('Document Revoked')).toBeInTheDocument();
            });
        });

        it('shows REVOKED badge', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('REVOKED')).toBeInTheDocument();
            });
        });

        it('does NOT show Document Verified for a revoked document', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => screen.getByText('Document Revoked'));
            expect(screen.queryByText('Document Verified')).not.toBeInTheDocument();
        });
    });

    describe('not found', () => {
        beforeEach(() => {
            mockContract._verifyDocument.mockResolvedValue({
                revert: undefined,
                properties: {
                    exists: false,
                    signer: 0n,
                    blockHeight: 0n,
                    revoked: false,
                },
            });
        });

        it('shows Not Found banner when signer is 0n', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('Not Found')).toBeInTheDocument();
            });
        });

        it('shows the "No record found" description', async () => {
            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText(/No record found/i)).toBeInTheDocument();
            });
        });
    });

    describe('contract revert / error', () => {
        it('shows error message when contract reverts', async () => {
            mockContract._verifyDocument.mockResolvedValueOnce({
                revert: 'Call failed',
                properties: undefined,
            });

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText(/Query failed: Call failed/)).toBeInTheDocument();
            });
        });

        it('shows error when contract call throws', async () => {
            mockContract._verifyDocument.mockRejectedValueOnce(new Error('Network timeout'));

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('Network timeout')).toBeInTheDocument();
            });
        });

        it('shows error when contract is null', async () => {
            vi.mocked(useOpSignContract).mockReturnValue(null);

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText(/Contract not available/i)).toBeInTheDocument();
            });
        });
    });

    describe('reset', () => {
        it('shows Verify Another File button after result', async () => {
            mockContract._verifyDocument.mockResolvedValue({
                revert: undefined,
                properties: { exists: false, signer: 0n, blockHeight: 0n, revoked: false },
            });

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => screen.getByText('Not Found'));
            expect(screen.getByRole('button', { name: /Verify Another File/i })).toBeInTheDocument();
        });

        it('resets to idle state when Verify Another File is clicked', async () => {
            mockContract._verifyDocument.mockResolvedValue({
                revert: undefined,
                properties: { exists: false, signer: 0n, blockHeight: 0n, revoked: false },
            });

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => screen.getByText('Not Found'));
            fireEvent.click(screen.getByRole('button', { name: /Verify Another File/i }));

            expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
        });
    });

    describe('hashing error', () => {
        it('shows error when file hashing fails', async () => {
            vi.mocked(hashDocumentToU256).mockRejectedValueOnce(new Error('Read error'));

            render(<VerifyTab {...defaultProps} />);
            const input = document.getElementById('verify-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('Failed to compute file hash.')).toBeInTheDocument();
            });
        });
    });
});
