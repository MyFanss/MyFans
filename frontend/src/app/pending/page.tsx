/**
 * /pending — Transaction status page (#1660)
 *
 * Auth required: users are redirected to /auth/sign-in by the server
 * middleware (middleware.ts) before this page renders.
 *
 * What this page does
 * ───────────────────
 * After a checkout completes the subscribe flow pushes a `TrackedTransaction`
 * into localStorage and redirects here with `?checkoutId=<id>`.  This page
 * renders the live status of that checkout and a filterable history of all
 * previous on-device transactions.
 *
 * The data source is the local transaction-history store (localStorage), which
 * is seeded by the checkout flow and polled every 3 s by PendingStatusClient.
 * When the backend event-indexer emits a confirmed event the checkout page
 * writes `status: 'confirmed'` before redirecting, so there is no "infinite
 * spinner" for real subscriptions — only the demo/simulated completion timer
 * triggers automatic status advancement.
 *
 * No infinite demo spinner
 * ────────────────────────
 * `pollTrackedTransaction()` in transaction-history.ts advances a pending
 * transaction to 'confirmed' after `simulatedCompletionAt` passes (12 s
 * default).  This only fires for demo-seeded transactions.  Real checkouts
 * have their status written by the checkout flow before they reach this page,
 * so they never sit in an infinite pending state.
 */
import type { Metadata } from "next";
import { PendingStatusClient } from "@/clients";

export const metadata: Metadata = {
  title: "Transaction status | MyFans",
  description: "Check the status of your pending and recent transactions.",
  robots: { index: false },
};

export default function PendingPage() {
  return (
    <main id="main-content">
      <PendingStatusClient />
    </main>
  );
}
