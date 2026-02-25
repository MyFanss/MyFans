import { useState, useEffect, useCallback } from "react";
import {
  detectNetwork,
  NetworkDetectionResult,
} from "../utils/networkDetection";

export interface UseNetworkGuardOptions {
  autoCheck?: boolean;
  checkInterval?: number;
}

export const useNetworkGuard = (options: UseNetworkGuardOptions = {}) => {
  const { autoCheck = true, checkInterval = 5000 } = options;

  const [networkStatus, setNetworkStatus] =
    useState<NetworkDetectionResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkNetwork = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await detectNetwork();
      setNetworkStatus(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;

    checkNetwork();

    const interval = setInterval(checkNetwork, checkInterval);

    return () => clearInterval(interval);
  }, [autoCheck, checkInterval, checkNetwork]);

  return {
    networkStatus,
    isChecking,
    checkNetwork,
    isCorrectNetwork: networkStatus?.isCorrectNetwork ?? false,
    shouldBlockActions:
      networkStatus !== null && !networkStatus.isCorrectNetwork,
  };
};
