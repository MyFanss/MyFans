import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Pending page.
 *
 * Decision (see frontend/docs/PENDING_PAGE.md): the pending page renders only
 * real pending checkouts/transactions fetched from the pending API. When the
 * API is unavailable or returns nothing, we show an honest empty state instead
 * of fabricated items. In production builds the page is hard-removed from the
 * router (see App.tsx / check-demo-routes.mjs), so no fake pending data can
 * ever reach production users.
 */

export interface PendingItem {
  id: string;
  kind: 'checkout' | 'transaction';
  status: 'pending' | 'confirming' | 'stuck';
  createdAt: string;
  /** Real on-chain hash when available. Never fabricated. */
  txHash?: string;
  amount?: string;
  currency?: string;
}

const PENDING_API = '/api/pending';

/** Items older than this are surfaced as stuck so users get a clear next step. */
const STUCK_AFTER_MS = 30 * 60 * 1000;

function isStuck(item: PendingItem, now: number): boolean {
  if (item.status === 'stuck') return true;
  const created = Date.parse(item.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created > STUCK_AFTER_MS;
}

async function fetchPending(signal: AbortSignal): Promise<PendingItem[]> {
  const res = await fetch(PENDING_API, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Pending API responded ${res.status}`);
  const data = (await res.json()) as { items?: PendingItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export default function PendingPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchPending(controller.signal)
      .then((next) => {
        if (active) setItems(next);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load pending items');
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Keep stuck detection fresh without refetching.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hasStuck = useMemo(() => items.some((item) => isStuck(item, now)), [items, now]);

  return (
    <section className="pending-page" aria-labelledby="pending-heading">
      <header className="pending-page__header">
        <h1 id="pending-heading">Pending</h1>
        <p className="pending-page__subtitle">
          Checkouts and transactions that have not settled yet.
        </p>
      </header>

      {loading && (
        <p role="status" className="pending-page__status">
          Loading pending items…
        </p>
      )}

      {!loading && error && (
        <div role="alert" className="pending-page__error">
          <p>We couldn’t load your pending items right now.</p>
          <p className="pending-page__error-detail">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="pending-page__empty">
          Nothing is pending. New checkouts and transactions will appear here until they settle.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="pending-page__list">
          {items.map((item) => {
            const stuck = isStuck(item, now);
            return (
              <li key={item.id} className="pending-page__item">
                <div className="pending-page__item-main">
                  <span className="pending-page__item-kind">
                    {item.kind === 'checkout' ? 'Checkout' : 'Transaction'}
                  </span>
                  {item.amount && (
                    <span className="pending-page__item-amount">
                      {item.amount} {item.currency ?? ''}
                    </span>
                  )}
                </div>

                <div className="pending-page__item-meta">
                  <span className={`pending-page__badge pending-page__badge--${stuck ? 'stuck' : item.status}`}>
                    {stuck ? 'Taking longer than expected' : item.status}
                  </span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>

                {item.txHash ? (
                  <a
                    className="pending-page__hash"
                    href={`/tx/${item.txHash}`}
                    rel="noreferrer"
                  >
                    {item.txHash}
                  </a>
                ) : (
                  <span className="pending-page__hash pending-page__hash--none">
                    Awaiting confirmation
                  </span>
                )}

                {stuck && (
                  <p className="pending-page__stuck-hint">
                    This has been pending for a while. You can retry or contact support from{' '}
                    <Link to="/support">Support</Link>.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasStuck && (
        <p className="pending-page__footer-note">
          Some items are taking longer than expected. We never show placeholder hashes — only real
          on-chain data appears here.
        </p>
      )}
    </section>
  );
}
