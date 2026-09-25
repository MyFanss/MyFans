/**
 * Network detection and passphrase guard for the Freighter reference wallet path.
 *
 * The app must never build or sign a transaction while the wallet is pointed at a
 * different network than the one the app is configured for. This module keeps the
 * passphrase comparison in one place so connect/sign flows can guard consistently.
 */

export type WalletNetwork = "testnet" | "mainnet" | "futurenet" | "standalone" | "unknown";

/** Canonical Stellar network passphrases. */
export const NETWORK_PASSPHRASES: Record<Exclude<WalletNetwork, "unknown">, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  standalone: "Standalone Network ; February 2017",
};

/**
 * Resolve the app's configured network from an explicit value or env var.
 * Defaults to testnet so demos never silently target Mainnet.
 */
export function getConfiguredNetwork(explicit?: string | null): WalletNetwork {
  const raw = (explicit ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet")
    .toString()
    .trim()
    .toLowerCase();

  if (raw === "public" || raw === "mainnet") return "mainnet";
  if (raw === "testnet" || raw === "test") return "testnet";
  if (raw === "futurenet") return "futurenet";
  if (raw === "standalone" || raw === "local") return "standalone";
  return "unknown";
}

/** Map a network passphrase reported by the wallet back to a known network. */
export function networkFromPassphrase(passphrase?: string | null): WalletNetwork {
  if (!passphrase) return "unknown";
  const normalized = passphrase.trim();
  for (const [network, value] of Object.entries(NETWORK_PASSPHRASES)) {
    if (value === normalized) return network as WalletNetwork;
  }
  return "unknown";
}

/** Human-readable label for a network, safe to show in the UI. */
export function networkLabel(network: WalletNetwork): string {
  switch (network) {
    case "mainnet":
      return "Mainnet";
    case "testnet":
      return "Testnet";
    case "futurenet":
      return "Futurenet";
    case "standalone":
      return "Standalone";
    default:
      return "Unknown network";
  }
}

export interface NetworkGuardResult {
  ok: boolean;
  configured: WalletNetwork;
  wallet: WalletNetwork;
  message?: string;
}

/**
 * Guard that blocks transaction building/signing when the wallet's active network
 * does not match the app's configured network.
 */
export function guardNetwork(
  walletPassphrase: string | null | undefined,
  configuredNetwork?: string | null,
): NetworkGuardResult {
  const configured = getConfiguredNetwork(configuredNetwork);
  const wallet = networkFromPassphrase(walletPassphrase);

  if (configured === "unknown") {
    return {
      ok: false,
      configured,
      wallet,
      message:
        "App network is not configured. Set NEXT_PUBLIC_STELLAR_NETWORK to testnet or mainnet before signing.",
    };
  }

  if (wallet === "unknown") {
    return {
      ok: false,
      configured,
      wallet,
      message:
        "Could not determine the wallet's network. Open Freighter and select a network, then retry.",
    };
  }

  if (wallet !== configured) {
    return {
      ok: false,
      configured,
      wallet,
      message: `Network mismatch: the app is on ${networkLabel(
        configured,
      )} but your wallet is on ${networkLabel(
        wallet,
      )}. Switch Freighter to ${networkLabel(configured)} and retry.`,
    };
  }

  return { ok: true, configured, wallet };
}
