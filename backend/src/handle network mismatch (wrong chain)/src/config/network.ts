export type StellarNetwork = "testnet" | "mainnet";

export interface NetworkConfig {
  name: StellarNetwork;
  passphrase: string;
  horizonUrl: string;
}

export const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    name: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    name: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
  },
};

export const getExpectedNetwork = (): NetworkConfig => {
  const networkName = (import.meta.env.VITE_STELLAR_NETWORK ||
    "testnet") as StellarNetwork;
  return NETWORK_CONFIGS[networkName];
};
