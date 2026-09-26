import React from 'react';
import { useNetworkGuard } from '../hooks/useNetworkGuard';

/**
 * Persistent banner shown whenever the connected wallet's network does not
 * match the network the app expects. Renders nothing when the guard reports
 * a match, so it can be mounted unconditionally at the app root.
 */
export function NetworkMismatchBanner(): JSX.Element | null {
  const { isMismatch, expectedNetwork, actualNetwork, isUnknown } = useNetworkGuard();

  if (!isMismatch) {
    return null;
  }

  const actualLabel = isUnknown ? 'unknown / unreachable' : actualNetwork;

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
      Expected <code>{expectedNetwork}</code> but wallet is on{' '}
      <code>{actualLabel}</code>. Mutating actions are blocked until the
      network matches.
    </div>
  );
}

export default NetworkMismatchBanner;
