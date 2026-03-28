import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkSwitchPrompt } from "../NetworkSwitchPrompt";

describe("NetworkSwitchPrompt", () => {
  const mockNetworkStatus = {
    isCorrectNetwork: false,
    currentNetwork: "mainnet",
    expectedNetwork: {
      name: "testnet" as const,
      passphrase: "Test SDF Network ; September 2015",
      horizonUrl: "https://horizon-testnet.stellar.org",
    },
  };

  it("should not render when on correct network", () => {
    const correctNetworkStatus = {
      ...mockNetworkStatus,
      isCorrectNetwork: true,
    };

    const { container } = render(
      <NetworkSwitchPrompt networkStatus={correctNetworkStatus} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render warning message when on wrong network", () => {
    render(<NetworkSwitchPrompt networkStatus={mockNetworkStatus} />);

    expect(screen.getByText("Wrong Network Detected")).toBeInTheDocument();
    expect(screen.getByText(/You are connected to/)).toBeInTheDocument();
    expect(screen.getByText(/mainnet/)).toBeInTheDocument();
    expect(screen.getByText(/testnet/)).toBeInTheDocument();
  });

  it("should show blocked actions message when blockActions is true", () => {
    render(
      <NetworkSwitchPrompt
        networkStatus={mockNetworkStatus}
        blockActions={true}
      />,
    );

    expect(screen.getByText(/Actions are blocked/)).toBeInTheDocument();
  });

  it("should not show blocked actions message when blockActions is false", () => {
    render(
      <NetworkSwitchPrompt
        networkStatus={mockNetworkStatus}
        blockActions={false}
      />,
    );

    expect(screen.queryByText(/Actions are blocked/)).not.toBeInTheDocument();
  });

  it("should call setNetwork when switch button is clicked", async () => {
    const mockSetNetwork = vi.fn().mockResolvedValue(undefined);
    window.freighterApi = {
      setNetwork: mockSetNetwork,
    } as unknown as FreighterApi;

    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<NetworkSwitchPrompt networkStatus={mockNetworkStatus} />);

    const switchButton = screen.getByText(/Switch to testnet/);
    fireEvent.click(switchButton);

    expect(mockSetNetwork).toHaveBeenCalledWith("testnet");
  });

  it("should show dismiss button when blockActions is false and onDismiss is provided", () => {
    const onDismiss = vi.fn();
    render(
      <NetworkSwitchPrompt
        networkStatus={mockNetworkStatus}
        blockActions={false}
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = screen.getByText("Dismiss");
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("should not show dismiss button when blockActions is true", () => {
    const onDismiss = vi.fn();
    render(
      <NetworkSwitchPrompt
        networkStatus={mockNetworkStatus}
        blockActions={true}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.queryByText("Dismiss")).not.toBeInTheDocument();
  });
});
