import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignTab } from './SignTab';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../hooks/useOpSign', () => ({
    useOpSignContract: vi.fn(),
}));

vi.mock('../utils/hashDocument', () => ({
    hashDocumentToU256: vi.fn(),
    formatHashHex: (h: bigint) => '0x' + h.toString(16).padStart(64, '0'),
    truncateHash: (h: string) => h.slice(0, 10) + '…' + h.slice(-6),
}));

vi.mock('../config/networks', () => ({
    getExplorerUrl: () => 'https://mempool.opnet.org/testnet4/tx/',
}));

import { useOpSignContract } from '../hooks/useOpSign';
import { hashDocumentToU256 } from '../utils/hashDocument';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'doc.pdf', size = 1024): File {
    return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

const mockContract = {
    _signDocument: vi.fn(),
};

const defaultProps = {
    network: { network: 'testnet' } as never,
    walletAddress: 'opt1pq45c7qx5snvrgfv9drnl',
    connected: true,
    onConnect: vi.fn(),
    connecting: false,
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOpSignContract).mockReturnValue(mockContract as never);
    vi.mocked(hashDocumentToU256).mockResolvedValue(
        BigInt('0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
    );
    mockContract._signDocument.mockResolvedValue({
        revert: undefined,
        sendTransaction: vi.fn().mockResolvedValue({ result: 'abc123txid' }),
    });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SignTab', () => {
    describe('initial render', () => {
        it('shows the Sign a Document heading', () => {
            render(<SignTab {...defaultProps} />);
            expect(screen.getByText('Sign a Document')).toBeInTheDocument();
        });

        it('shows the drop zone instruction', () => {
            render(<SignTab {...defaultProps} />);
            expect(screen.getByText(/Drop any file here/i)).toBeInTheDocument();
        });

        it('shows Connect Wallet button when not connected', () => {
            render(<SignTab {...defaultProps} connected={false} />);
            expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
        });

        it('shows Sign Document button when connected', () => {
            render(<SignTab {...defaultProps} />);
            expect(screen.getByRole('button', { name: /Sign Document/i })).toBeInTheDocument();
        });

        it('Sign Document button is disabled when no file selected', () => {
            render(<SignTab {...defaultProps} />);
            expect(screen.getByRole('button', { name: /Sign Document/i })).toBeDisabled();
        });
    });

    describe('file selection', () => {
        it('shows file name after input change', async () => {
            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;

            const file = makeFile('contract.pdf');
            fireEvent.change(input, { target: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('contract.pdf')).toBeInTheDocument();
            });
        });

        it('shows hash preview after file is hashed', async () => {
            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;

            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByText('SHA-256 Hash')).toBeInTheDocument();
            });
        });

        it('enables Sign Document button after hashing', async () => {
            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;

            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Sign Document/i })).not.toBeDisabled();
            });
        });
    });

    describe('connect wallet flow', () => {
        it('calls onConnect when Connect Wallet is clicked', () => {
            const onConnect = vi.fn();
            render(<SignTab {...defaultProps} connected={false} onConnect={onConnect} />);
            fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
            expect(onConnect).toHaveBeenCalledOnce();
        });

        it('shows Connecting when connecting is true', () => {
            render(<SignTab {...defaultProps} connected={false} connecting={true} />);
            expect(screen.getByRole('button', { name: /Connecting/i })).toBeInTheDocument();
        });

        it('connect button is disabled while connecting', () => {
            render(<SignTab {...defaultProps} connected={false} connecting={true} />);
            expect(screen.getByRole('button', { name: /Connecting/i })).toBeDisabled();
        });
    });

    describe('sign flow', () => {
        async function selectFileAndSign() {
            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });
            await waitFor(() => screen.getByRole('button', { name: /Sign Document/i }));
            fireEvent.click(screen.getByRole('button', { name: /Sign Document/i }));
        }

        it('shows success banner after successful transaction', async () => {
            await selectFileAndSign();
            await waitFor(() => {
                expect(screen.getByText('Document Signed on Bitcoin L1!')).toBeInTheDocument();
            });
        });

        it('shows explorer link with txid after success', async () => {
            await selectFileAndSign();
            await waitFor(() => {
                const link = screen.getByRole('link', { name: /View Transaction/i });
                expect(link).toHaveAttribute('href', expect.stringContaining('abc123txid'));
            });
        });

        it('shows error when simulation reverts', async () => {
            mockContract._signDocument.mockResolvedValueOnce({
                revert: 'Document already registered',
                sendTransaction: vi.fn(),
            });

            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });
            await waitFor(() => screen.getByRole('button', { name: /Sign Document/i }));
            fireEvent.click(screen.getByRole('button', { name: /Sign Document/i }));

            await waitFor(() => {
                expect(screen.getByText(/Document already registered/)).toBeInTheDocument();
            });
        });

        it('shows error when sendTransaction throws', async () => {
            mockContract._signDocument.mockResolvedValueOnce({
                revert: undefined,
                sendTransaction: vi.fn().mockRejectedValueOnce(new Error('User rejected')),
            });

            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });
            await waitFor(() => screen.getByRole('button', { name: /Sign Document/i }));
            fireEvent.click(screen.getByRole('button', { name: /Sign Document/i }));

            await waitFor(() => {
                expect(screen.getByText('User rejected')).toBeInTheDocument();
            });
        });

        it('shows Sign Another Document button after success', async () => {
            await selectFileAndSign();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Sign Another Document/i })).toBeInTheDocument();
            });
        });

        it('resets state when Sign Another Document is clicked', async () => {
            await selectFileAndSign();
            await waitFor(() => screen.getByRole('button', { name: /Sign Another Document/i }));
            fireEvent.click(screen.getByRole('button', { name: /Sign Another Document/i }));

            expect(screen.queryByText('Document Signed on Bitcoin L1!')).not.toBeInTheDocument();
        });
    });

    describe('no contract', () => {
        it('Sign Document button is disabled when contract is null', async () => {
            vi.mocked(useOpSignContract).mockReturnValue(null);
            render(<SignTab {...defaultProps} />);
            const input = document.getElementById('sign-file-input') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Sign Document/i })).toBeDisabled();
            });
        });
    });
});
