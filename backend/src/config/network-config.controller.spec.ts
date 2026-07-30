import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { NetworkConfigController } from './network-config.controller';
import { NetworkConfigService } from './network-config.service';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

describe('NetworkConfigController', () => {
  let controller: NetworkConfigController;
  let service: { getNetworkConfig: jest.Mock };

  beforeEach(async () => {
    service = { getNetworkConfig: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NetworkConfigController],
      providers: [{ provide: NetworkConfigService, useValue: service }],
    }).compile();

    controller = module.get(NetworkConfigController);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the network config from the service', () => {
    const config = {
      network: 'testnet',
      networkPassphrase: 'Test SDF Network ; September 2015',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      rpcUrl: 'https://soroban-testnet.stellar.org',
    };
    service.getNetworkConfig.mockReturnValue(config);

    const result = controller.getNetworkConfig();

    expect(result).toBe(config);
  });

  it('is marked @Public() so it bypasses JwtAuthGuard', () => {
    const reflector = new Reflector();
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      NetworkConfigController.prototype.getNetworkConfig,
      NetworkConfigController,
    ]);
    expect(isPublic).toBe(true);
  });
});
