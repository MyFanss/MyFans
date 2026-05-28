'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
import { useRpcStatus, type RpcStatusResult } from '@/hooks/useRpcStatus';

const RpcStatusContext = createContext<RpcStatusResult | undefined>(undefined);

export function RpcStatusProvider({ children }: { children: ReactNode }) {
  const rpcStatus = useRpcStatus();
  return (
    <RpcStatusContext.Provider value={rpcStatus}>
      {children}
    </RpcStatusContext.Provider>
  );
}

export function useRpcStatusContext(): RpcStatusResult {
  const ctx = useContext(RpcStatusContext);
  if (!ctx) throw new Error('useRpcStatusContext must be used inside RpcStatusProvider');
  return ctx;
}
