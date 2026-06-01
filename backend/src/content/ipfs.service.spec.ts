import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IpfsService } from './ipfs.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeConfig = (jwt = 'test-jwt', gateway?: string) => ({
  get: jest.fn((key: string, def?: string) => {
    if (key === 'IPFS_PINATA_JWT') return jwt;
    if (key === 'IPFS_GATEWAY_URL') return gateway ?? def;
    return def;
  }),
});

describe('IpfsService', () => {
  let service: IpfsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();
    service = module.get(IpfsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns cid and url on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ IpfsHash: 'bafytest123' }),
    });

    const result = await service.uploadMetadata({ title: 'Test' });

    expect(result.cid).toBe('bafytest123');
    expect(result.url).toContain('bafytest123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pinata.cloud'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when IPFS_PINATA_JWT is not set', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        { provide: ConfigService, useValue: makeConfig('') },
      ],
    }).compile();
    const svc = module.get(IpfsService);

    await expect(svc.uploadMetadata({ title: 'x' })).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    await expect(service.uploadMetadata({ title: 'x' })).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    await expect(service.uploadMetadata({ title: 'x' })).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
