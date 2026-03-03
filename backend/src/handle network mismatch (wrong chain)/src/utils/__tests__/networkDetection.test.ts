import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectNetwork, getNetworkName } from "../networkDetection";
import { NETWORK_CONFIGS } from "../../config/network";

describe("networkDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectNetwork", () => {
    it("should detect correct network when on testnet", async () => {
      const mockApi = {
        getNetworkDetails: vi.fn().mockResolvedValue({
          network: "testnet",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      };
      window.freighterApi = mockApi as unknown as FreighterApi;

      const result = await detectNetwork();

      expect(result.isCorrectNetwork).toBe(true);
      expect(result.currentNetwork).toBe("testnet");
      expect(result.expectedNetwork.name).toBe("testnet");
    });

    it("should detect wrong network when on mainnet but expecting testnet", async () => {
      const mockApi = {
        getNetworkDetails: vi.fn().mockResolvedValue({
          network: "mainnet",
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        }),
      };
      window.freighterApi = mockApi as unknown as FreighterApi;

      const result = await detectNetwork();

      expect(result.isCorrectNetwork).toBe(false);
      expect(result.currentNetwork).toBe("mainnet");
      expect(result.expectedNetwork.name).toBe("testnet");
    });

    it("should return false when Freighter is not available", async () => {
      window.freighterApi = undefined;

      const result = await detectNetwork();

      expect(result.isCorrectNetwork).toBe(false);
      expect(result.currentNetwork).toBe(null);
    });

    it("should handle errors gracefully", async () => {
      const mockApi = {
        getNetworkDetails: vi
          .fn()
          .mockRejectedValue(new Error("Network error")),
      };
      window.freighterApi = mockApi as unknown as FreighterApi;

      const result = await detectNetwork();

      expect(result.isCorrectNetwork).toBe(false);
      expect(result.currentNetwork).toBe(null);
    });
  });

  describe("getNetworkName", () => {
    it("should return testnet for testnet passphrase", () => {
      const name = getNetworkName(NETWORK_CONFIGS.testnet.passphrase);
      expect(name).toBe("testnet");
    });

    it("should return mainnet for mainnet passphrase", () => {
      const name = getNetworkName(NETWORK_CONFIGS.mainnet.passphrase);
      expect(name).toBe("mainnet");
    });

    it("should return unknown for unrecognized passphrase", () => {
      const name = getNetworkName("Unknown Network");
      expect(name).toBe("unknown");
    });
  });
});
