import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Freighter API
const mockFreighterApi: FreighterApi = {
  isConnected: vi.fn().mockResolvedValue(true),
  getPublicKey: vi.fn().mockResolvedValue("GTEST..."),
  signTransaction: vi.fn().mockResolvedValue("signed_xdr"),
  getNetworkDetails: vi.fn().mockResolvedValue({
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
  }),
  setNetwork: vi.fn().mockResolvedValue(undefined),
};

// Setup global window mock
global.window = global.window || ({} as Window & typeof globalThis);
(global.window as Window).freighterApi = mockFreighterApi;

// Mock import.meta.env
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_STELLAR_NETWORK: "testnet",
    },
  },
});
