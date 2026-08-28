'use client';

import { useEffect, useState } from 'react';
import { getRuntimeContractConfig } from '@/lib/contract-config';
import { getVersionedApiBaseUrl } from '@/lib/api/base-url';
import { stellarNetworkLabel } from '@/lib/network-label';

export function useBackendNetwork(): string {
  const [network, setNetwork] = useState(() =>
    stellarNetworkLabel(getRuntimeContractConfig().network),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getVersionedApiBaseUrl()}/config/network`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((config: { network: string }) => setNetwork(stellarNetworkLabel(config.network)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return network;
}
