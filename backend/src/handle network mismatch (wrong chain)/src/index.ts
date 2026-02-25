export { NetworkGuard } from "./components/NetworkGuard";
export type { NetworkGuardProps } from "./components/NetworkGuard";

export { NetworkSwitchPrompt } from "./components/NetworkSwitchPrompt";
export type { NetworkSwitchPromptProps } from "./components/NetworkSwitchPrompt";

export { useNetworkGuard } from "./hooks/useNetworkGuard";
export type { UseNetworkGuardOptions } from "./hooks/useNetworkGuard";

export { detectNetwork, getNetworkName } from "./utils/networkDetection";
export type { NetworkDetectionResult } from "./utils/networkDetection";

export { getExpectedNetwork, NETWORK_CONFIGS } from "./config/network";
export type { StellarNetwork, NetworkConfig } from "./config/network";
