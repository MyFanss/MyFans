"use client";

import { useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { hasStoredUserId } from "@/lib/auth-storage";

export function useAuth() {
  const { isConnected, hasCheckedConnection } = useWallet();
  const hasStoredSession = useMemo(() => hasStoredUserId(), []);
  const isAuthenticated = isConnected || hasStoredSession;
  const isLoading = !hasCheckedConnection && !hasStoredSession;

  return {
    isAuthenticated,
    isLoading,
    hasStoredSession,
  };
}
