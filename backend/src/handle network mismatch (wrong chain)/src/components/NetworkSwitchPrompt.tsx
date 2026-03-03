import React from "react";
import { NetworkDetectionResult } from "../utils/networkDetection";

export interface NetworkSwitchPromptProps {
  networkStatus: NetworkDetectionResult;
  onDismiss?: () => void;
  blockActions?: boolean;
}

export const NetworkSwitchPrompt: React.FC<NetworkSwitchPromptProps> = ({
  networkStatus,
  onDismiss,
  blockActions = true,
}) => {
  const { isCorrectNetwork, currentNetwork, expectedNetwork } = networkStatus;

  if (isCorrectNetwork) {
    return null;
  }

  const handleSwitchNetwork = async () => {
    try {
      if (window.freighterApi) {
        await window.freighterApi.setNetwork(expectedNetwork.name);
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#fff3cd",
        border: "1px solid #ffc107",
        borderRadius: "8px",
        padding: "16px 24px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 9999,
        maxWidth: "500px",
        width: "90%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ fontSize: "24px" }}>⚠️</div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            Wrong Network Detected
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#333" }}>
            {currentNetwork ? (
              <>
                You are connected to <strong>{currentNetwork}</strong>, but this
                app requires <strong>{expectedNetwork.name}</strong>.
              </>
            ) : (
              <>
                Please connect to <strong>{expectedNetwork.name}</strong> to use
                this app.
              </>
            )}
          </p>
          {blockActions && (
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                color: "#856404",
              }}
            >
              Actions are blocked until you switch to the correct network.
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSwitchNetwork}
              style={{
                backgroundColor: "#ffc107",
                color: "#000",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Switch to {expectedNetwork.name}
            </button>
            {!blockActions && onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  backgroundColor: "transparent",
                  color: "#856404",
                  border: "1px solid #856404",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
