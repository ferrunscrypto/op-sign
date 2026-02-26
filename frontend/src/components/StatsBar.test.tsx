import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatsBar } from './StatsBar';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../hooks/useOpSign', () => ({
    useOpSignContract: vi.fn(),
}));

vi.mock('../hooks/useProvider', () => ({
    useProvider: vi.fn(),
}));

vi.mock('../utils/resolveAddress', () => ({
    resolveAddress: vi.fn(),
}));

import { useOpSignContract } from '../hooks/useOpSign';
import { useProvider } from '../hooks/useProvider';
import { resolveAddress } from '../utils/resolveAddress';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockProvider = {};
const RESOLVED_ADDRESS = { toString: () => 'opt1p_resolved' };

const mockContract = {
    _getDocCount: vi.fn(),
    _getSignerDocCount: vi.fn(),
};

const defaultProps = {
    network: { network: 'testnet' } as never,
    walletAddress: 'opt1pq45c7qx5snvrgfv9drnl',
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOpSignContract).mockReturnValue(mockContract as never);
    vi.mocked(useProvider).mockReturnValue(mockProvider as never);
    vi.mocked(resolveAddress).mockResolvedValue(RESOLVED_ADDRESS as never);

    mockContract._getDocCount.mockResolvedValue({
        properties: { count: 42n },
    });
    mockContract._getSignerDocCount.mockResolvedValue({
        revert: undefined,
        properties: { count: 5n },
    });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StatsBar', () => {
    describe('initial render', () => {
        it('shows Platform Stats heading', () => {
            render(<StatsBar {...defaultProps} />);
            expect(screen.getByText('Platform Stats')).toBeInTheDocument();
        });

        it('shows "Total Documents Notarised" label', () => {
            render(<StatsBar {...defaultProps} />);
            expect(screen.getByText('Total Documents Notarised')).toBeInTheDocument();
        });

        it('shows Signer Profile section', () => {
            render(<StatsBar {...defaultProps} />);
            expect(screen.getByText('Signer Profile')).toBeInTheDocument();
        });

        it('pre-fills the signer input with walletAddress', () => {
            render(<StatsBar {...defaultProps} />);
            const input = screen.getByPlaceholderText(/opt1p/i) as HTMLInputElement;
            expect(input.value).toBe('opt1pq45c7qx5snvrgfv9drnl');
        });
    });

    describe('total doc count', () => {
        it('fetches and displays total doc count on mount', async () => {
            render(<StatsBar {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('42')).toBeInTheDocument();
            });
        });

        it('shows dash (—) when contract is null', async () => {
            vi.mocked(useOpSignContract).mockReturnValue(null);
            render(<StatsBar {...defaultProps} />);

            // No fetch attempt; should show placeholder
            expect(screen.getByText('—')).toBeInTheDocument();
        });

        it('silently shows — when _getDocCount rejects', async () => {
            mockContract._getDocCount.mockRejectedValueOnce(new Error('Network error'));
            render(<StatsBar {...defaultProps} />);

            // Should show — gracefully, no error thrown
            await waitFor(() => {
                expect(screen.getByText('—')).toBeInTheDocument();
            });
        });
    });

    describe('signer lookup', () => {
        it('shows Lookup button', () => {
            render(<StatsBar {...defaultProps} />);
            expect(screen.getByRole('button', { name: /Lookup/i })).toBeInTheDocument();
        });

        it('shows signer document count after lookup', async () => {
            render(<StatsBar {...defaultProps} />);

            // Wait for total count load
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText('5')).toBeInTheDocument();
            });
        });

        it('shows "5 documents notarised" pluralised text', async () => {
            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText('5 documents notarised')).toBeInTheDocument();
            });
        });

        it('shows "1 document notarised" singular text when count is 1', async () => {
            mockContract._getSignerDocCount.mockResolvedValueOnce({
                revert: undefined,
                properties: { count: 1n },
            });

            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText('1 document notarised')).toBeInTheDocument();
            });
        });

        it('shows "No documents on record" when count is 0', async () => {
            mockContract._getSignerDocCount.mockResolvedValueOnce({
                revert: undefined,
                properties: { count: 0n },
            });

            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText('No documents on record')).toBeInTheDocument();
            });
        });

        it('shows error when resolveAddress returns null', async () => {
            vi.mocked(resolveAddress).mockResolvedValueOnce(null);

            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText(/Could not resolve address/i)).toBeInTheDocument();
            });
        });

        it('shows error when contract call reverts', async () => {
            mockContract._getSignerDocCount.mockResolvedValueOnce({
                revert: 'Some revert message',
                properties: undefined,
            });

            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText(/Query failed: Some revert message/)).toBeInTheDocument();
            });
        });

        it('shows error when lookup throws', async () => {
            mockContract._getSignerDocCount.mockRejectedValueOnce(new Error('Timeout'));

            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            fireEvent.click(screen.getByRole('button', { name: /Lookup/i }));

            await waitFor(() => {
                expect(screen.getByText('Timeout')).toBeInTheDocument();
            });
        });

        it('Lookup button is disabled when input is empty', async () => {
            render(<StatsBar { ...defaultProps } walletAddress={null} />);

            // Wait for mount
            await waitFor(() => {});

            const input = screen.getByPlaceholderText(/opt1p/i) as HTMLInputElement;
            fireEvent.change(input, { target: { value: '' } });

            expect(screen.getByRole('button', { name: /Lookup/i })).toBeDisabled();
        });

        it('Enter key triggers lookup', async () => {
            render(<StatsBar {...defaultProps} />);
            await waitFor(() => screen.getByText('42'));

            const input = screen.getByPlaceholderText(/opt1p/i);
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(mockContract._getSignerDocCount).toHaveBeenCalled();
            });
        });
    });

    describe('wallet address pre-fill', () => {
        it('updates signer input when walletAddress changes', async () => {
            const { rerender } = render(<StatsBar { ...defaultProps } walletAddress={null} />);

            rerender(<StatsBar { ...defaultProps } walletAddress="opt1pnewaddress" />);

            const input = screen.getByPlaceholderText(/opt1p/i) as HTMLInputElement;
            expect(input.value).toBe('opt1pnewaddress');
        });
    });
});
