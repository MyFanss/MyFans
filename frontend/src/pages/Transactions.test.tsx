import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Transactions, { isRealHash, explorerUrl } from './Transactions';
import { fetchCheckoutHistory } from '../api/checkout';

vi.mock('../api/checkout', () => ({ fetchCheckoutHistory: vi.fn() }));
vi.mock('../config/network', () => ({ getActiveNetwork: vi.fn(() => 'testnet') }));

describe('Transactions.tsx', () => {
  beforeEach(() => vi.clearAllMocks());
  it('isRealHash accepts 64-hex and rejects invalid/placeholders', () => {
    const valid = 'a'.repeat(64);
    expect(isRealHash(valid)).toBe(true);
    expect(isRealHash('F'.repeat(64))).toBe(true);
    for (const bad of [null, undefined, '', 'abc', 'g'.repeat(64), 'pending', 'TBD', '0x' + valid]) {
      expect(isRealHash(bad)).toBe(false);
    }
  });

  it('explorerUrl formats URL with encoded hash', () => {
    expect(explorerUrl('public', 'h1')).toBe('https://stellar.expert/explorer/public/tx/h1');
    expect(explorerUrl('testnet', 'h 1')).toBe('https://stellar.expert/explorer/testnet/tx/h%201');
    expect(explorerUrl('futurenet', 'h1')).toBe('https://stellar.expert/explorer/futurenet/tx/h1');
  });

  it('renders real-hash anchor and hashless pending span', async () => {
    const hash = 'a'.repeat(64);
    vi.mocked(fetchCheckoutHistory).mockResolvedValueOnce([
      { id: '1', createdAt: '', status: 'completed', amount: '10', currency: 'XLM', txHash: hash },
      { id: '2', createdAt: '', status: 'pending', amount: '5', currency: 'XLM', txHash: null },
    ]);
    render(<Transactions />);
    const link = await screen.findByRole('link', { name: /…/ });
    expect(link.getAttribute('href')).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('handles error and retry path', async () => {
    vi.mocked(fetchCheckoutHistory).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([]);
    render(<Transactions />);
    const retry = await screen.findByRole('button', { name: /retry/i });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(fetchCheckoutHistory).toHaveBeenCalledTimes(2));
  });
});
