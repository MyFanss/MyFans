import { Networks } from '@stellar/stellar-sdk';
import { NetworkConfigService } from './network-config.service';

describe('NetworkConfigService', () => {
  let service: NetworkConfigService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    service = new NetworkConfigService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to testnet when STELLAR_NETWORK is unset', () => {
    delete process.env.STELLAR_NETWORK;

    const result = service.getNetworkConfig();

    expect(result.network).toBe('testnet');
    expect(result.networkPassphrase).toBe(Networks.TESTNET);
    expect(result.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(result.rpcUrl).toBe('https://soroban-testnet.stellar.org');
  });

  it('resolves the mainnet passphrase and endpoints', () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    delete process.env.STELLAR_NETWORK_PASSPHRASE;
    delete process.env.HORIZON_URL;
    delete process.env.SOROBAN_RPC_URL;

    const result = service.getNetworkConfig();

    expect(result.network).toBe('mainnet');
    expect(result.networkPassphrase).toBe(Networks.PUBLIC);
    expect(result.horizonUrl).toBe('https://horizon.stellar.org');
  });

  it('resolves the futurenet passphrase', () => {
    process.env.STELLAR_NETWORK = 'futurenet';
    delete process.env.STELLAR_NETWORK_PASSPHRASE;

    const result = service.getNetworkConfig();

    expect(result.networkPassphrase).toBe(Networks.FUTURENET);
  });

  it('is case-insensitive for STELLAR_NETWORK', () => {
    process.env.STELLAR_NETWORK = 'TESTNET';

    const result = service.getNetworkConfig();

    expect(result.network).toBe('testnet');
  });

  it('prefers an explicit STELLAR_NETWORK_PASSPHRASE override', () => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_NETWORK_PASSPHRASE = 'Custom Passphrase';

    const result = service.getNetworkConfig();

    expect(result.networkPassphrase).toBe('Custom Passphrase');
  });

  it('prefers explicit HORIZON_URL and SOROBAN_RPC_URL overrides', () => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.HORIZON_URL = 'https://custom-horizon.example.com';
    process.env.SOROBAN_RPC_URL = 'https://custom-rpc.example.com';

    const result = service.getNetworkConfig();

    expect(result.horizonUrl).toBe('https://custom-horizon.example.com');
    expect(result.rpcUrl).toBe('https://custom-rpc.example.com');
  });

  it('never includes secret-bearing fields such as JWT_SECRET or WEBHOOK_SECRET', () => {
    process.env.JWT_SECRET = 'super-secret';
    process.env.WEBHOOK_SECRET = 'another-secret';

    const result = service.getNetworkConfig();

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('another-secret');
    expect(Object.keys(result).sort()).toEqual(
      [
        'contractIds',
        'horizonUrl',
        'network',
        'networkPassphrase',
        'rpcUrl',
      ].sort(),
    );
  });
});
