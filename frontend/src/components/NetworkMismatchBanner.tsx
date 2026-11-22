import React from 'react';
import { useNetworkGuard } from '../hooks/useNetworkGuard';

export interface NetworkMismatchBannerProps {
  /**
   * Expected network label to show. When provided (together with
   * `actualNetwork`), the banner is driven entirely by these props and the
   * internal `useNetworkGuard()` app-root guard is bypassed. This lets a
   * caller that already computed its own guard result against a different
   * "expected" network — e.g. `SubscribeConfirm`, which guards against the
   * loaded plan's network rather than the static app default — reuse this
   * shared banner instead of keeping its own copy of the markup/text.
   */
  expectedNetwork?: string;
  /** Actual/connected network label to show. Only used with `expectedNetwork`. */
  actualNetwork?: string | null;
  /** Whether the networks currently mismatch. Only used with `expectedNetwork`. */
  isMismatch?: boolean;
}

/**
 * Persistent banner shown whenever the connected wallet's network does not
 * match the network the app expects. Renders nothing when the guard reports
 * a match, so it can be mounted unconditionally at the app root.
 */
export function NetworkMismatchBanner(
  props: NetworkMismatchBannerProps = {},
): JSX.Element | null {
  const overridden = props.expectedNetwork !== undefined;
  // Skip the hook's own polling when the caller drives the banner directly;
  // its result is simply unused in that case.
  const guard = useNetworkGuard(overridden ? { pollIntervalMs: 0 } : undefined);

  const isMismatch = overridden ? Boolean(props.isMismatch) : guard.mismatch;
  const expectedNetwork = overridden ? (props.expectedNetwork as string) : guard.expected;
  const actualNetwork = overridden ? props.actualNetwork ?? null : guard.actual;
  const isUnknown = actualNetwork === null || actualNetwork === 'unknown';

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
