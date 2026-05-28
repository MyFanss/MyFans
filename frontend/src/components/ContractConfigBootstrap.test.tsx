import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContractConfigBootstrap } from '@/components/ContractConfigBootstrap';
import type { RuntimeContractConfig } from '@/lib/contract-config';

const VALID_CONTRACT = 'CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF';
const OTHER_VALID_CONTRACT = 'CDV2DF2BV3R7UM4LPETP77DAERE4DYX3FLC7HRVJV3KVHON7ZGLFLQ4U';

const validConfig: RuntimeContractConfig = {
  environment: 'preview',
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  contractIds: {
    token: VALID_CONTRACT,
    creatorRegistry: OTHER_VALID_CONTRACT,
    subscription: VALID_CONTRACT,
    contentAccess: OTHER_VALID_CONTRACT,
    earnings: VALID_CONTRACT,
  },
};

describe('ContractConfigBootstrap', () => {
  it('renders children and injects the runtime config script when config is valid', () => {
    const { container } = render(
      <ContractConfigBootstrap config={validConfig}>
        <div>App ready</div>
      </ContractConfigBootstrap>,
    );

    expect(screen.getByText('App ready')).toBeInTheDocument();

    const script = container.querySelector('script');
    expect(script).toBeInTheDocument();
    expect(script?.textContent).toContain('__MYFANS_RUNTIME_CONTRACT_CONFIG__');
    expect(script?.textContent).toContain('"environment":"preview"');
  });

  it('renders a graceful fallback when required contract IDs are missing or invalid', () => {
    render(
      <ContractConfigBootstrap
        config={{
          ...validConfig,
          contractIds: {
            ...validConfig.contractIds,
            token: 'not-a-contract',
            subscription: '',
          },
        }}
      >
        <div>App ready</div>
      </ContractConfigBootstrap>,
    );

    expect(screen.getByText('Contract configuration is incomplete')).toBeInTheDocument();
    expect(screen.getByText('preview')).toBeInTheDocument();
    expect(screen.getByText('testnet')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('MyFans token')).toBeInTheDocument();
    expect(screen.queryByText('App ready')).not.toBeInTheDocument();
  });
});
