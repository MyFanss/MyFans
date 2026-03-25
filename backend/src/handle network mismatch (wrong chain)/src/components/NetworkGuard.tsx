import React from "react";
import { useNetworkGuard } from "../hooks/useNetworkGuard";
import { NetworkSwitchPrompt } from "./NetworkSwitchPrompt";

export interface NetworkGuardProps {
  children: React.ReactNode;
  blockActions?: boolean;
  showPrompt?: boolean;
}

export const NetworkGuard: React.FC<NetworkGuardProps> = ({
  children,
  blockActions = true,
  showPrompt = true,
}) => {
  const { networkStatus, shouldBlockActions } = useNetworkGuard();

  return (
    <>
      {showPrompt && networkStatus && !networkStatus.isCorrectNetwork && (
        <NetworkSwitchPrompt
          networkStatus={networkStatus}
          blockActions={blockActions}
        />
      )}
      {blockActions && shouldBlockActions ? (
        <div style={{ opacity: 0.5, pointerEvents: "none" }}>{children}</div>
      ) : (
        children
      )}
    </>
  );
};
