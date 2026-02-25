import {
  getExpectedNetwork,
  NetworkConfig,
  NETWORK_CONFIGS,
} from "../config/network";

export interface NetworkDetectionResult {
  isCorrectNetwork: boolean;
  currentNetwork: string | null;
  expectedNetwork: NetworkConfig;
}

export const detectNetwork = async (): Promise<NetworkDetectionResult> => {
  const expectedNetwork = getExpectedNetwork();

  try {
    // Check if Freighter is available
    if (!window.freighterApi) {
      return {
        isCorrectNetwork: false,
        currentNetwork: null,
        expectedNetwork,
      };
    }

    // Get network details from Freighter
    const networkDetails = await window.freighterApi.getNetworkDetails();

    if (!networkDetails) {
      return {
        isCorrectNetwork: false,
        currentNetwork: null,
        expectedNetwork,
      };
    }

    // Compare network passphrase
    const isCorrectNetwork =
      networkDetails.networkPassphrase === expectedNetwork.passphrase;

    return {
      isCorrectNetwork,
      currentNetwork:
        networkDetails.network || networkDetails.networkPassphrase,
      expectedNetwork,
    };
  } catch (error) {
    console.error("Error detecting network:", error);
    return {
      isCorrectNetwork: false,
      currentNetwork: null,
      expectedNetwork,
    };
  }
};

export const getNetworkName = (passphrase: string): string => {
  const network = Object.values(NETWORK_CONFIGS).find(
    (config) => config.passphrase === passphrase,
  );
  return network?.name || "unknown";
};
