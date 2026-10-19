/**
 * Network guard utilities.
 *
 * Ensures the wallet/network used for signing matches the network the
 * subscription plan (and therefore the transaction) is expected to settle on.
 * Used by the subscribe confirm page to disable signing on mismatch.
 */

export type StellarNetwork = "PUBLIC" | "TESTNET" | "FUTURENET" | "STANDALONE";

export interface NetworkGuardResult {
  ok: boolean;
  expected: StellarNetwork;
  actual: StellarNetwork | null;
  reason?: string;
}

const KNOWN_NETWORKS: readonly StellarNetwork[] = [
  "PUBLIC",
  "TESTNET",
  "FUTURENET",
  "STANDALONE",
];

/**
 * Normalize a raw network identifier (passphrase, name, or enum) into a
 * canonical StellarNetwork value. Returns null when unrecognized.
 */
export function normalizeNetwork(raw: string | null | undefined): StellarNetwork | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();

  if ((KNOWN_NETWORKS as readonly string[]).includes(value)) {
    return value as StellarNetwork;
  }

  // Match by well-known network passphrase fragments. Order matters here:
  // the more specific networks (FUTURENET, TESTNET, STANDALONE) must be
  // checked before the generic PUBLIC fallback, and PUBLIC itself must
  // require the actual public-network passphrase fragment rather than a
  // bare "PUBLIC" substring. Otherwise an unrelated passphrase that merely
  // contains the word "PUBLIC" (e.g. a custom/standalone passphrase like
  // "Standalone Network ; PUBLIC") would shadow the network it's actually
  // naming and normalize to PUBLIC — defeating the point of this guard
  // (#2006).
  if (value.includes("FUTURENET") || value.includes("FUTURE NETWORK")) {
    return "FUTURENET";
  }
  if (value.includes("TESTNET") || value.includes("TEST SDF NETWORK")) {
    return "TESTNET";
  }
  if (value.includes("STANDALONE")) return "STANDALONE";
  if (value.includes("PUBLIC GLOBAL")) return "PUBLIC";

  return null;
}

/**
 * Compare the network the plan expects against the network the wallet is
 * currently connected to. The confirm page uses this to gate the sign action
 * so displayed parameters always match the transaction environment.
 */
export function checkNetworkGuard(
  expectedRaw: string | null | undefined,
  actualRaw: string | null | undefined,
): NetworkGuardResult {
  const expected = normalizeNetwork(expectedRaw);
  const actual = normalizeNetwork(actualRaw);

  if (!expected) {
    return {
      ok: false,
      expected: "PUBLIC",
      actual,
      reason: "Plan network is unknown or unsupported.",
    };
  }

  if (!actual) {
    return {
      ok: false,
      expected,
      actual: null,
      reason: "Wallet network could not be determined.",
    };
  }

  if (expected !== actual) {
    return {
      ok: false,
      expected,
      actual,
      reason: `Wallet is on ${actual} but this plan settles on ${expected}.`,
    };
  }

  return { ok: true, expected, actual };
}

/**
 * Convenience predicate for call sites that only need a boolean gate.
 */
export function isNetworkMatch(
  expectedRaw: string | null | undefined,
  actualRaw: string | null | undefined,
): boolean {
  return checkNetworkGuard(expectedRaw, actualRaw).ok;
}
