import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpiryDisplay } from './ExpiryDisplay';
import * as useClockSkewModule from '@/hooks/useClockSkew';
import type { ClockSkew } from '@/hooks/useClockSkew';

const BASE_UNIX = 1_700_000_000;

function makeSkew(skewMs: number): ClockSkew {
  return {
    skewMs,
    ledgerSeq: 100_000,
    ledgerCloseTimeUnix: BASE_UNIX,
    fetchedAtMs: BASE_UNIX * 1000 - skewMs,
  };
}

describe('ExpiryDisplay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Expires in Xd" for a future expiry with zero skew', () => {
    const nowUnix = BASE_UNIX;
    vi.spyOn(Date, 'now').mockReturnValue(nowUnix * 1000);
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: makeSkew(0),
      loading: false,
      error: null,
    });
    vi.spyOn(useClockSkewModule, 'ledgerNowUnix').mockReturnValue(nowUnix);

    const expiryUnix = nowUnix + 5 * 86400; // 5 days from now
    render(<ExpiryDisplay expiryUnix={expiryUnix} />);

    expect(screen.getByRole('time')).toHaveTextContent('Expires in 5d');
  });

  it('shows "Expired" for a past expiry', () => {
    const nowUnix = BASE_UNIX;
    vi.spyOn(Date, 'now').mockReturnValue(nowUnix * 1000);
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: makeSkew(0),
      loading: false,
      error: null,
    });
    vi.spyOn(useClockSkewModule, 'ledgerNowUnix').mockReturnValue(nowUnix);

    const expiryUnix = nowUnix - 3600; // 1 hour ago
    render(<ExpiryDisplay expiryUnix={expiryUnix} />);

    expect(screen.getByRole('time')).toHaveTextContent('Expired');
  });

  it('applies negative skew: ledger behind wall clock makes expiry appear sooner', () => {
    const wallNowUnix = BASE_UNIX;
    const skewMs = -10_000; // ledger 10s behind wall
    const ledgerNow = wallNowUnix - 10; // ledger thinks it's 10s earlier

    vi.spyOn(Date, 'now').mockReturnValue(wallNowUnix * 1000);
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: makeSkew(skewMs),
      loading: false,
      error: null,
    });
    vi.spyOn(useClockSkewModule, 'ledgerNowUnix').mockReturnValue(ledgerNow);

    // Expiry is 5s after wall now, but 15s after ledger now
    const expiryUnix = wallNowUnix + 5;
    render(<ExpiryDisplay expiryUnix={expiryUnix} />);

    // With ledger now = wallNow - 10, diff = expiryUnix - ledgerNow = 15s
    expect(screen.getByRole('time')).toHaveTextContent('Expires in 15s');
  });

  it('shows loading skeleton when skew is loading', () => {
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: null,
      loading: true,
      error: null,
    });

    render(<ExpiryDisplay expiryUnix={BASE_UNIX + 86400} />);
    expect(screen.getByLabelText('Loading expiry')).toBeInTheDocument();
  });

  it('shows fallback with warning when skew fetch errors', () => {
    const nowUnix = BASE_UNIX;
    vi.spyOn(Date, 'now').mockReturnValue(nowUnix * 1000);
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: null,
      loading: false,
      error: 'Horizon 503',
    });

    const expiryUnix = nowUnix + 2 * 86400;
    render(<ExpiryDisplay expiryUnix={expiryUnix} />);

    const el = screen.getByText(/Expires in 2d/);
    expect(el).toBeInTheDocument();
    expect(el.title).toMatch(/Clock skew unavailable/);
  });

  it('includes ledger seq in tooltip when provided', () => {
    const nowUnix = BASE_UNIX;
    vi.spyOn(Date, 'now').mockReturnValue(nowUnix * 1000);
    vi.spyOn(useClockSkewModule, 'useClockSkew').mockReturnValue({
      skew: makeSkew(0),
      loading: false,
      error: null,
    });
    vi.spyOn(useClockSkewModule, 'ledgerNowUnix').mockReturnValue(nowUnix);

    render(<ExpiryDisplay expiryUnix={nowUnix + 86400} expiryLedgerSeq={123456} />);

    const el = screen.getByRole('time');
    expect(el.title).toMatch(/Ledger #123456/);
  });
});
