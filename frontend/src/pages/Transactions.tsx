import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCheckoutHistory, type CheckoutHistoryEntry } from '../api/checkout';
import { getActiveNetwork, type StellarNetwork } from '../config/network';

/**
 * Explorer deep-link builders keyed by the active Stellar network.
 * Only real signed transaction hashes are ever linked; pending entries
 * (no hash yet) render an explicit pending indicator instead of a
 * placeholder hash.
 */
const EXPLORER_BASE: Record<StellarNetwork, string> = {
  public: 'https://stellar.expert/explorer/public/tx/',
  testnet: 'https://stellar.expert/explorer/testnet/tx/',
  futurenet: 'https://stellar.expert/explorer/futurenet/tx/',
};

function explorerUrl(network: StellarNetwork, hash: string): string {
  return `${EXPLORER_BASE[network]}${encodeURIComponent(hash)}`;
}

function isRealHash(hash: string | null | undefined): hash is string {
  if (!hash) return false;
  const trimmed = hash.trim();
  // Stellar tx hashes are 64 hex chars. Reject placeholders like "pending",
  // "0x...", "TBD", or anything that is not a real signed hash.
  return /^[0-9a-fA-F]{64}$/.test(trimmed);
}

function formatAmount(entry: CheckoutHistoryEntry): string {
  if (entry.amount == null) return '—';
  const asset = entry.asset ?? 'XLM';
  return `${entry.amount} ${asset}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function Transactions() {
  const [entries, setEntries] = useState<CheckoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const network = useMemo(() => getActiveNetwork(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await fetchCheckoutHistory();
      setEntries(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="transactions-page">
      <header className="transactions-page__header">
        <h1>Transactions</h1>
        <p className="transactions-page__subtitle">
          Checkout history with signed transaction hashes on the{' '}
          <strong>{network}</strong> network.
        </p>
      </header>

      {loading && (
        <p className="transactions-page__status" role="status">
          Loading transactions…
        </p>
      )}

      {!loading && error && (
        <div className="transactions-page__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="transactions-page__empty">
          No transactions yet. Completed checkouts will appear here.
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <table className="transactions-page__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDate(entry.createdAt)}</td>
                <td>{entry.description ?? 'Checkout'}</td>
                <td>{formatAmount(entry)}</td>
                <td>
                  {isRealHash(entry.txHash) ? (
                    <a
                      href={explorerUrl(network, entry.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transactions-page__hash"
                    >
                      {entry.txHash.slice(0, 8)}…{entry.txHash.slice(-8)}
                    </a>
                  ) : (
                    <span
                      className="transactions-page__pending"
                      title="Transaction hash not available yet"
                    >
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="transactions-page__back">
        <Link to="/">Back to dashboard</Link>
      </p>
    </main>
  );
}
