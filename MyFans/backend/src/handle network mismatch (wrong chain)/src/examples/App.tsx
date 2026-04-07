import React from "react";
import { NetworkGuard } from "../components/NetworkGuard";

export const App: React.FC = () => {
  const handleSubscribe = () => {
    console.log("Subscribe action");
  };

  const handlePay = () => {
    console.log("Pay action");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Stellar Subscription App</h1>

      {/* Wrap actions that require correct network */}
      <NetworkGuard blockActions={true} showPrompt={true}>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={handleSubscribe}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Subscribe
          </button>

          <button
            onClick={handlePay}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Pay
          </button>
        </div>
      </NetworkGuard>

      {/* Content that doesn't require network guard */}
      <div style={{ marginTop: "40px" }}>
        <h2>About</h2>
        <p>This content is always visible regardless of network.</p>
      </div>
    </div>
  );
};
