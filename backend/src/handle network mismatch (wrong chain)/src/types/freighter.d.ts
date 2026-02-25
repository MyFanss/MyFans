interface FreighterApi {
  isConnected(): Promise<boolean>;
  getPublicKey(): Promise<string>;
  signTransaction(
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string },
  ): Promise<string>;
  getNetworkDetails(): Promise<{ network: string; networkPassphrase: string }>;
  setNetwork(network: "testnet" | "mainnet"): Promise<void>;
}

interface Window {
  freighterApi?: FreighterApi;
}
