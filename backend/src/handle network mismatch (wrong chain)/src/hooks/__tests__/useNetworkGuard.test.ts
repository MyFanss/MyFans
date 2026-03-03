import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNetworkGuard } from "../useNetworkGuard";
import * as networkDetection from "../../utils/networkDetection";

vi.mock("../../utils/networkDetection");

describe("useNetworkGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should check network on mount when autoCheck is true", async () => {
    const mockResult = {
      isCorrectNetwork: true,
      currentNetwork: "testnet",
      expectedNetwork: {
        name: "testnet" as const,
        passphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
    };
    vi.spyOn(networkDetection, "detectNetwork").mockResolvedValue(mockResult);

    const { result } = renderHook(() => useNetworkGuard());

    await waitFor(() => {
      expect(result.current.networkStatus).toEqual(mockResult);
    });

    expect(networkDetection.detectNetwork).toHaveBeenCalled();
    expect(result.current.isCorrectNetwork).toBe(true);
    expect(result.current.shouldBlockActions).toBe(false);
  });

  it("should not check network on mount when autoCheck is false", async () => {
    vi.spyOn(networkDetection, "detectNetwork").mockResolvedValue({
      isCorrectNetwork: true,
      currentNetwork: "testnet",
      expectedNetwork: {
        name: "testnet" as const,
        passphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
    });

    const { result } = renderHook(() => useNetworkGuard({ autoCheck: false }));

    expect(result.current.networkStatus).toBe(null);
    expect(networkDetection.detectNetwork).not.toHaveBeenCalled();
  });

  it("should indicate actions should be blocked when on wrong network", async () => {
    const mockResult = {
      isCorrectNetwork: false,
      currentNetwork: "mainnet",
      expectedNetwork: {
        name: "testnet" as const,
        passphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
    };
    vi.spyOn(networkDetection, "detectNetwork").mockResolvedValue(mockResult);

    const { result } = renderHook(() => useNetworkGuard());

    await waitFor(() => {
      expect(result.current.shouldBlockActions).toBe(true);
    });

    expect(result.current.isCorrectNetwork).toBe(false);
  });

  it("should allow manual network check", async () => {
    const mockResult = {
      isCorrectNetwork: true,
      currentNetwork: "testnet",
      expectedNetwork: {
        name: "testnet" as const,
        passphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
    };
    vi.spyOn(networkDetection, "detectNetwork").mockResolvedValue(mockResult);

    const { result } = renderHook(() => useNetworkGuard({ autoCheck: false }));

    await result.current.checkNetwork();

    await waitFor(() => {
      expect(result.current.networkStatus).toEqual(mockResult);
    });
  });
});
