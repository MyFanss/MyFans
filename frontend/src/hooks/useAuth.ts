"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { hasStoredUserId, clearStoredUserId } from "@/lib/auth-storage";
import { fetchMe, type MeResponse } from "@/lib/api/profile";

export function useAuth() {
  const { isConnected, hasCheckedConnection } = useWallet();
  const hasStoredSession = useMemo(() => hasStoredUserId(), []);

  const [sessionData, setSessionData] = useState<MeResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStoredSession || isConnected) {
      return;
    }

    const validateSession = async () => {
      setIsValidating(true);
      setValidationError(null);

      try {
        const data = await fetchMe();
        setSessionData(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Session validation failed";
        setValidationError(message);
        clearStoredUserId();
        setSessionData(null);
      } finally {
        setIsValidating(false);
      }
    };

    void validateSession();
  }, [hasStoredSession, isConnected]);

  const isAuthenticated = isConnected || (hasStoredSession && sessionData !== null);
  const isLoading =
    (!hasCheckedConnection && !hasStoredSession) ||
    (hasStoredSession && isValidating);

  return {
    isAuthenticated,
    isLoading,
    hasStoredSession,
    sessionData,
    validationError,
  };
}
