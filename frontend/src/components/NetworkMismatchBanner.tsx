import React from 'react';
import { useNetworkGuard, type UseNetworkGuardOptions } from '../hooks/useNetworkGuard';

export type NetworkMismatchBannerProps = UseNetworkGuardOptions;

/**
 * Persistent banner shown whenever the connected wallet's network does not
 * match the network the app expects. Renders nothing when the guard reports
 * a match, so it can be mounted unconditionally.
 *
 * Forwards its props straight to useNetworkGuard, so a caller that knows how
 * to read the live wallet network (expected + resolveActual) can wire this
 * up for its own screen; callers with no props fail closed (see the hook's
 * default behavior).
 */
export function NetworkMismatchBanner(props: NetworkMismatchBannerProps = {}): JSX.Element | null {
  const { mismatch, expected, actual, unreachable } = useNetworkGuard(props);

  if (!mismatch) {
    return null;
  }

  const actualLabel = unreachable || actual === 'unknown' ? 'unknown / unreachable' : actual;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="network-mismatch-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        width: '100%',
        padding: '0.75rem 1rem',
        background: '#7f1d1d',
        color: '#fff',
        fontSize: '0.875rem',
        lineHeight: 1.4,
        textAlign: 'center',
      }}
    >
      <strong>Wrong network.</strong>{' '}
      Expected <code>{expected}</code> but wallet is on{' '}
      <code>{actualLabel}</code>. Mutating actions are blocked until the
      network matches.
    </div>
  );
}

export default NetworkMismatchBanner;
