import { render, screen, fireEvent } from "@testing-library/react";
import TransactionProgress from "./TransactionProgress";

describe("TransactionProgress", () => {
  it("renders signing stage", () => {
    render(<TransactionProgress stage="signing" />);
    expect(screen.getByText(/Signing transaction/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // Step indicator
  });

  it("renders pending stage", () => {
    render(<TransactionProgress stage="pending" />);
    expect(
      screen.getByText(/Transaction is being processed/i),
    ).toBeInTheDocument();
  });

  it("renders confirmed stage with txHash", () => {
    render(<TransactionProgress stage="confirmed" txHash="abc123" />);
    expect(screen.getByText(/Transaction confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("renders failed stage with error and retry button", () => {
    const onRetry = jest.fn();
    render(
      <TransactionProgress
        stage="failed"
        error="Network error"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Transaction failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders txHash as a link in confirmed stage", () => {
    const txHash = "abc123";
    render(<TransactionProgress stage="confirmed" txHash={txHash} />);
    const link = screen.getByText(txHash);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      `https://explorer.example.com/tx/${txHash}`,
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});
