/**
 * Pending checkouts / transactions API.
 *
 * Issue #1836: the Pending page must never surface fabricated pending items in
 * production. This module is the single source of truth for pending data and
 * enforces that contract:
 *
 *  - In production builds, if no real pending API endpoint is configured
 *    (`VITE_PENDING_API_URL`), the page is treated as unavailable and returns
 *    an empty list instead of inventing fake pending checkouts/txs.
 *  - Transaction hashes are only ever passed through from the backend; we never
 *    synthesize or fabricate a hash.
 *  - Stuck pending items are surfaced with an `isStuck` flag and a timeout so
 *    the UI can show a recovery affordance instead of an endless spinner.
 *
 * See frontend/docs/PENDING_PAGE.md for the documented decision.
 */

export type PendingKind = "checkout" | "transaction";

export type PendingStatus = "pending" | "confirming" | "stuck";

export interface PendingItem {
  id: string;
  kind: PendingKind;
  status: PendingStatus;
  /** ISO timestamp of when the item entered the pending state. */
  createdAt: string;
  /** Only present when the backend actually provides one. Never fabricated. */
  txHash?: string;
  /** Human-readable label for the item (e.g. "Checkout #1234"). */
  label?: string;
  /** True when the item has exceeded the stuck-pending timeout. */
  isStuck: boolean;
}

/** Items pending longer than this are considered stuck and need user action. */
export const PENDING_STUCK_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Whether the pending API is available in this build.
 *
 * Production builds require an explicitly configured endpoint. Without one we
 * refuse to render pending data rather than fabricating it.
 */
export function isPendingApiAvailable(): boolean {
  const url = import.meta.env?.VITE_PENDING_API_URL;
  if (url && url.trim().length > 0) {
    return true;
  }
  // In non-production (dev/test) we allow the local mock endpoint.
  return import.meta.env?.MODE !== "production";
}

function resolveEndpoint(): string | null {
  const url = import.meta.env?.VITE_PENDING_API_URL;
  if (url && url.trim().length > 0) {
    return url.trim();
  }
  if (import.meta.env?.MODE !== "production") {
    return "/api/pending";
  }
  return null;
}

function isStuck(createdAt: string, now: number = Date.now()): boolean {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return false;
  }
  return now - created > PENDING_STUCK_TIMEOUT_MS;
}

/**
 * Normalize a raw backend record into a PendingItem.
 *
 * We deliberately do not generate a `txHash` when the backend omits it — a
 * fabricated hash would be worse than showing none.
 */
function normalize(raw: Partial<PendingItem> & { id: string; createdAt: string }): PendingItem {
  const stuck = isStuck(raw.createdAt);
  const status: PendingStatus = stuck ? "stuck" : raw.status === "confirming" ? "confirming" : "pending";
  return {
    id: raw.id,
    kind: raw.kind === "transaction" ? "transaction" : "checkout",
    status,
    createdAt: raw.createdAt,
    txHash: typeof raw.txHash === "string" && raw.txHash.length > 0 ? raw.txHash : undefined,
    label: raw.label,
    isStuck: stuck,
  };
}

/**
 * Fetch real pending checkouts/transactions.
 *
 * Returns an empty list (never fabricated data) when the pending API is not
 * available in this build. Callers should check `isPendingApiAvailable()` to
 * decide whether to render the page at all.
 */
export async function fetchPendingItems(signal?: AbortSignal): Promise<PendingItem[]> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    return [];
  }

  const res = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to load pending items (${res.status})`);
  }

  const data = (await res.json()) as unknown;
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];

  return list
    .filter((item): item is Partial<PendingItem> & { id: string; createdAt: string } => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { createdAt?: unknown }).createdAt === "string"
      );
    })
    .map(normalize);
}
