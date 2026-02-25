import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetworkGuard } from "../NetworkGuard";
import * as useNetworkGuardHook from "../../hooks/useNetworkGuard";

vi.mock("../../hooks/useNetworkGuard");

describe("NetworkGuard", () => {
  it("should render children when on correct network", () => {
    vi.spyOn(useNetworkGuardHook, "useNetworkGuard").mockReturnValue({
      networkStatus: {
        isCorrectNetwork: true,
        currentNetwork: "testnet",
        expectedNetwork: {
          name: "testnet" as const,
          passphrase: "Test SDF Network ; September 2015",
          horizonUrl: "https://horizon-testnet.stellar.org",
        },
      },
      isChecking: false,
      checkNetwork: vi.fn(),
      isCorrectNetwork: true,
      shouldBlockActions: false,
    });

    render(
      <NetworkGuard>
        <button>Subscribe</button>
      </NetworkGuard>,
    );

    const button = screen.getByText("Subscribe");
    expect(button).toBeInTheDocument();
    expect(button.parentElement).not.toHaveStyle({ opacity: "0.5" });
  });

  it("should show prompt and block actions when on wrong network", () => {
    vi.spyOn(useNetworkGuardHook, "useNetworkGuard").mockReturnValue({
      networkStatus: {
        isCorrectNetwork: false,
        currentNetwork: "mainnet",
        expectedNetwork: {
          name: "testnet" as const,
          passphrase: "Test SDF Network ; September 2015",
          horizonUrl: "https://horizon-testnet.stellar.org",
        },
      },
      isChecking: false,
      checkNetwork: vi.fn(),
      isCorrectNetwork: false,
      shouldBlockActions: true,
    });

    render(
      <NetworkGuard blockActions={true}>
        <button>Subscribe</button>
      </NetworkGuard>,
    );

    expect(screen.getByText("Wrong Network Detected")).toBeInTheDocument();
    expect(screen.getByText(/You are connected to/)).toBeInTheDocument();

    const button = screen.getByText("Subscribe");
    expect(button.parentElement).toHaveStyle({
      opacity: "0.5",
      pointerEvents: "none",
    });
  });

  it("should not block actions when blockActions is false", () => {
    vi.spyOn(useNetworkGuardHook, "useNetworkGuard").mockReturnValue({
      networkStatus: {
        isCorrectNetwork: false,
        currentNetwork: "mainnet",
        expectedNetwork: {
          name: "testnet" as const,
          passphrase: "Test SDF Network ; September 2015",
          horizonUrl: "https://horizon-testnet.stellar.org",
        },
      },
      isChecking: false,
      checkNetwork: vi.fn(),
      isCorrectNetwork: false,
      shouldBlockActions: true,
    });

    render(
      <NetworkGuard blockActions={false}>
        <button>Subscribe</button>
      </NetworkGuard>,
    );

    const button = screen.getByText("Subscribe");
    expect(button.parentElement).not.toHaveStyle({ opacity: "0.5" });
  });

  it("should not show prompt when showPrompt is false", () => {
    vi.spyOn(useNetworkGuardHook, "useNetworkGuard").mockReturnValue({
      networkStatus: {
        isCorrectNetwork: false,
        currentNetwork: "mainnet",
        expectedNetwork: {
          name: "testnet" as const,
          passphrase: "Test SDF Network ; September 2015",
          horizonUrl: "https://horizon-testnet.stellar.org",
        },
      },
      isChecking: false,
      checkNetwork: vi.fn(),
      isCorrectNetwork: false,
      shouldBlockActions: true,
    });

    render(
      <NetworkGuard showPrompt={false}>
        <button>Subscribe</button>
      </NetworkGuard>,
    );

    expect(
      screen.queryByText("Wrong Network Detected"),
    ).not.toBeInTheDocument();
  });
});
