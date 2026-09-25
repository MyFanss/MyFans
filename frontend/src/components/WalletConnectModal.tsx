import { useCallback, useEffect, useState } from 'react';

/**
 * Freighter reference wallet path (issue #1809).
 *
 * Handles: detect/connect, network passphrase guard, signTransaction for
 * subscribe/cancel, and user-readable error mapping. Never asks for secret keys.
 */

type WalletId = 'freighter' | 'lobstr';

type WalletErrorCode =
  | 'missing'
  | 'wrong_network'
  | 'rejected'
  | 'popup_blocked'
  | 'unknown';

interface WalletError {
  code: WalletErrorCode;
  message: string;
}

interface FreighterApi {
  isConnected: () => Promise<boolean>;
  requestAccess: () => Promise<string>;
  getNetwork: () => Promise<{ network: string; networkPassphrase: string }>;
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase: string },
  ) => Promise<string>;
}

interface WalletConnectModalProps {
  /** App-configured network passphrase; the wallet must match this. */
  networkPassphrase: string;
  /** Human label for the configured network, e.g. "Testnet". */
  networkLabel?: string;
  /** Unsigned transaction XDR to sign (subscribe or cancel). */
  transactionXdr?: string;
  onConnected?: (publicKey: string) => void;
  onSigned?: (signedXdr: string) => void;
  onClose?: () => void;
}

function getFreighter(): FreighterApi | null {
  const w = window as unknown as { freighter?: FreighterApi };
  return w.freighter ?? null;
}

function mapError(err: unknown): WalletError {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('not installed') || lower.includes('not available')) {
    return {
      code: 'missing',
      message:
        'Freighter wallet not found. Install the Freighter browser extension and reload.',
    };
  }
  if (lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')) {
    return { code: 'rejected', message: 'Request rejected in Freighter.' };
  }
  if (lower.includes('popup') || lower.includes('blocked')) {
    return {
      code: 'popup_blocked',
      message: 'Freighter popup was blocked. Allow popups for this site and retry.',
    };
  }
  if (lower.includes('network') || lower.includes('passphrase')) {
    return {
      code: 'wrong_network',
      message: 'Freighter is on a different network than this app.',
    };
  }
  return { code: 'unknown', message: raw || 'Wallet request failed.' };
}

export default function WalletConnectModal({
  networkPassphrase,
  networkLabel = 'the configured network',
  transactionXdr,
  onConnected,
  onSigned,
  onClose,
}: WalletConnectModalProps) {
  const [wallet, setWallet] = useState<WalletId>('freighter');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [busy, setBusy] = useState(false);

  const freighterAvailable = typeof window !== 'undefined' && getFreighter() !== null;

  useEffect(() => {
    setError(null);
  }, [wallet]);

  const connect = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (wallet !== 'freighter') {
        throw new Error('Only Freighter is supported in this reference path.');
      }
      const api = getFreighter();
      if (!api) {
        throw new Error('Freighter not installed');
      }

      const key = await api.requestAccess();

      // Network passphrase guard: block before building any transaction.
      const net = await api.getNetwork();
      if (net.networkPassphrase !== networkPassphrase) {
        throw new Error(
          `Network mismatch: wallet is on ${net.network}, app expects ${networkLabel}`,
        );
      }

      setPublicKey(key);
      onConnected?.(key);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }, [wallet, networkPassphrase, networkLabel, onConnected]);

  const sign = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const api = getFreighter();
      if (!api) {
        throw new Error('Freighter not installed');
      }
      if (!transactionXdr) {
        throw new Error('No transaction to sign.');
      }

      // Re-validate network before signing (subscribe/cancel).
      const net = await api.getNetwork();
      if (net.networkPassphrase !== networkPassphrase) {
        throw new Error(
          `Network mismatch: wallet is on ${net.network}, app expects ${networkLabel}`,
        );
      }

      const signed = await api.signTransaction(transactionXdr, {
        networkPassphrase,
      });
      onSigned?.(signed);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }, [transactionXdr, networkPassphrase, networkLabel, onSigned]);

  return (
    <div role="dialog" aria-label="Connect wallet">
      <h2>Connect wallet</h2>

      <label>
        Wallet
        <select
          value={wallet}
          onChange={(e) => setWallet(e.target.value as WalletId)}
          disabled={busy}
        >
          <option value="freighter">Freighter</option>
          <option value="lobstr">Lobstr</option>
        </select>
      </label>

      {!freighterAvailable && wallet === 'freighter' && (
        <p role="alert">
          Freighter extension not detected. Install it and reload the page.
        </p>
      )}

      {publicKey ? (
        <p>
          Connected: <code>{publicKey}</code>
        </p>
      ) : (
        <button onClick={connect} disabled={busy || !freighterAvailable}>
          {busy ? 'Connecting…' : 'Connect Freighter'}
        </button>
      )}

      {publicKey && transactionXdr && (
        <button onClick={sign} disabled={busy}>
          {busy ? 'Signing…' : 'Sign transaction'}
        </button>
      )}

      {error && (
        <p role="alert" data-error-code={error.code}>
          {error.message}
        </p>
      )}

      {onClose && (
        <button onClick={onClose} disabled={busy}>
          Close
        </button>
      )}
    </div>
  );
}
