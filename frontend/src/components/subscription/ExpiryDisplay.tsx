'use client';

import { useMemo } from 'react';
import { useClockSkew, ledgerNowUnix } from '@/hooks/useClockSkew';

export interface ExpiryDisplayProps {
  /** Unix timestamp (seconds) of subscription expiry, as reported by the contract/backend. */
  expiryUnix: number;
  /** Ledger sequence number of expiry (optional; shown in tooltip). */
  expiryLedgerSeq?: number;
  className?: string;
}

function formatRelative(diffSec: number): string {
  const abs = Math.abs(diffSec);
  if (abs < 60) return `${Math.round(abs)}s`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h`;
  return `${Math.floor(abs / 86400)}d`;
}

/**
 * Renders a subscription expiry time corrected for ledger vs wall-clock skew.
 *
 * - Uses `useClockSkew` to fetch the current Stellar ledger close time.
 * - Computes "ledger now" = wall clock adjusted by skew.
 * - Shows remaining time relative to ledger now, not browser clock.
 * - Tooltip shows ISO expiry, ledger seq (if provided), and skew in ms.
 */
export function ExpiryDisplay({
  expiryUnix,
  expiryLedgerSeq,
  className = '',
}: ExpiryDisplayProps) {
  const { skew, loading, error } = useClockSkew();

  const { label, isExpired, tooltipText } = useMemo(() => {
    const nowUnix = skew ? ledgerNowUnix(skew) : Math.floor(Date.now() / 1000);
    const diffSec = expiryUnix - nowUnix;
    const expired = diffSec <= 0;

    const expiryIso = new Date(expiryUnix * 1000).toISOString();
    const skewNote = skew
      ? `Ledger skew: ${skew.skewMs > 0 ? '+' : ''}${skew.skewMs}ms`
      : 'Skew: unknown';
    const seqNote = expiryLedgerSeq != null ? ` · Ledger #${expiryLedgerSeq}` : '';

    return {
      label: expired ? 'Expired' : `Expires in ${formatRelative(diffSec)}`,
      isExpired: expired,
      tooltipText: `${expiryIso}${seqNote} · ${skewNote}`,
    };
  }, [skew, expiryUnix, expiryLedgerSeq]);

  if (loading) {
    return (
      <span
        className={`inline-block h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
        aria-label="Loading expiry"
      />
    );
  }

  if (error) {
    // Fall back to wall-clock display with a warning indicator
    const nowUnix = Math.floor(Date.now() / 1000);
    const diffSec = expiryUnix - nowUnix;
    const expired = diffSec <= 0;
    const fallbackLabel = expired ? 'Expired' : `Expires in ${formatRelative(diffSec)}`;
    return (
      <span
        title={`Clock skew unavailable: ${error}`}
        aria-label={fallbackLabel}
        className={`text-amber-600 dark:text-amber-400 ${className}`}
      >
        {fallbackLabel} ⚠
      </span>
    );
  }

  return (
    <time
      dateTime={new Date(expiryUnix * 1000).toISOString()}
      title={tooltipText}
      aria-label={label}
      className={`${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'} ${className}`}
    >
      {label}
    </time>
  );
}

export default ExpiryDisplay;
