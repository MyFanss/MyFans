'use client';

import { useEffect, useState } from 'react';
import { getRuntimeContractConfig } from '@/lib/contract-config';
import { getVersionedApiBaseUrl } from '@/lib/api/base-url';

function label(network: string) {
  return `Stellar ${network === 'mainnet' ? 'Public' : network[0].toUpperCase() + network.slice(1)}`;
}

export function useBackendNetwork(): string {
  const [network, setNetwork] = useState(() => label(getRuntimeContractConfig().network));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getVersionedApiBaseUrl()}/config/network`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((config: { network: string }) => setNetwork(label(config.network)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return network;
}
