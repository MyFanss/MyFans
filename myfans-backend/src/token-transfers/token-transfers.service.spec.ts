import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenTransfersService } from './token-transfers.service';
import { TokenTransfer, TransferDirection } from './entities/token-transfer.entity';

describe('TokenTransfersService', () => {
  let service: TokenTransfersService;
  let module: TestingModule;
  let mockRepository: any;

  const mockTokenTransfer: TokenTransfer = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    sender_address: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR',
    receiver_address: 'GBXP4ACUQG4C5SQNXQD5LT4DLPTVHVGWTZL4VMWFPWK6BXV7L3TAZQ47',
    account_address: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR',
    amount: '100.000000',
    token_type: 'TOKEN',
    direction: TransferDirection.OUTGOING,
    tx_hash: 'e2a6a5c4f3e4d3c2b1a0f9e8d7c6b5a4',
    contract_address: null,
    fee: '1.000000',
    net_amount: '99.000000',
    user_id: null,
    user: null,
    timestamp: new Date('2026-03-28T10:00:00Z'),
    created_at: new Date('2026-03-28T10:00:00Z'),
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockReturnValue(mockTokenTransfer),
      save: jest.fn().mockResolvedValue(mockTokenTransfer),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        TokenTransfersService,
        {
          provide: getRepositoryToken(TokenTransfer),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TokenTransfersService>(TokenTransfersService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('indexTransfer', () => {
    it('should index a new token transfer', async () => {
      const dto = {
        sender_address: mockTokenTransfer.sender_address,
        receiver_address: mockTokenTransfer.receiver_address,
        account_address: mockTokenTransfer.account_address,
        amount: '100.000000',
        direction: TransferDirection.OUTGOING,
        tx_hash: mockTokenTransfer.tx_hash,
        fee: '1.000000',
        net_amount: '99.000000',
      };

      const result = await service.indexTransfer(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender_address: dto.sender_address,
          receiver_address: dto.receiver_address,
          amount: '100.000000',
          direction: dto.direction,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTokenTransfer);
    });

    it('should handle optional fields', async () => {
      const dto = {
        sender_address: mockTokenTransfer.sender_address,
        receiver_address: mockTokenTransfer.receiver_address,
        account_address: mockTokenTransfer.account_address,
        amount: '50.000000',
        direction: TransferDirection.INCOMING,
        tx_hash: 'abc123def456',
      };

      await service.indexTransfer(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fee: null,
          net_amount: null,
        }),
      );
    });
  });

  describe('getTransferHistory', () => {
    it('should return paginated transfer history for an account', async () => {
      const mockTransfers = [mockTokenTransfer];
      mockRepository.findAndCount.mockResolvedValue([mockTransfers, 1]);

      const result = await service.getTransferHistory(
        mockTokenTransfer.account_address,
        50,
        0,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { account_address: mockTokenTransfer.account_address },
        order: { timestamp: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result.data).toEqual(mockTransfers);
      expect(result.total).toBe(1);
    });

    it('should apply limit and offset correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getTransferHistory(
        mockTokenTransfer.account_address,
        25,
        100,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 100,
        }),
      );
    });
  });

  describe('getIncomingTransfers', () => {
    it('should return incoming transfers for an account', async () => {
      const incomingTransfer = {
        ...mockTokenTransfer,
        direction: TransferDirection.INCOMING,
      };
      mockRepository.findAndCount.mockResolvedValue([[incomingTransfer], 1]);

      const result = await service.getIncomingTransfers(
        mockTokenTransfer.receiver_address,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            receiver_address: mockTokenTransfer.receiver_address,
            direction: TransferDirection.INCOMING,
          },
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  describe('getOutgoingTransfers', () => {
    it('should return outgoing transfers for an account', async () => {
      mockRepository.findAndCount.mockResolvedValue(
        [[mockTokenTransfer], 1],
      );

      const result = await service.getOutgoingTransfers(
        mockTokenTransfer.sender_address,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sender_address: mockTokenTransfer.sender_address,
            direction: TransferDirection.OUTGOING,
          },
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  describe('getTransferByTxHash', () => {
    it('should return a transfer by tx hash', async () => {
      mockRepository.findOne.mockResolvedValue(mockTokenTransfer);

      const result = await service.getTransferByTxHash(mockTokenTransfer.tx_hash);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { tx_hash: mockTokenTransfer.tx_hash },
      });
      expect(result).toEqual(mockTokenTransfer);
    });

    it('should return null if transfer not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getTransferByTxHash('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTransfersBetween', () => {
    it('should return transfers between two addresses', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockTokenTransfer], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getTransfersBetween(
        mockTokenTransfer.sender_address,
        mockTokenTransfer.receiver_address,
      );

      expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
      expect(result.data).toEqual([mockTokenTransfer]);
      expect(result.total).toBe(1);
    });
  });

  describe('getAccountStats', () => {
    it('should return aggregated account statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getCount: jest.fn(),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '500.000000' }) // incoming sum
        .mockResolvedValueOnce({ total: '250.000000' }) // outgoing sum
        .mockResolvedValueOnce({ total: '5.000000' }); // fees sum

      mockQueryBuilder.getCount
        .mockResolvedValueOnce(5) // incoming count
        .mockResolvedValueOnce(3); // outgoing count

      const result = await service.getAccountStats(
        mockTokenTransfer.account_address,
      );

      expect(result.totalIncoming).toBe('500.000000');
      expect(result.totalOutgoing).toBe('250.000000');
      expect(result.incomingCount).toBe(5);
      expect(result.outgoingCount).toBe(3);
      expect(result.totalFeesPaid).toBe('5.000000');
    });
  });

  describe('isTransferIndexed', () => {
    it('should return true if transfer is indexed', async () => {
      mockRepository.count.mockResolvedValue(1);

      const result = await service.isTransferIndexed(mockTokenTransfer.tx_hash);

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { tx_hash: mockTokenTransfer.tx_hash },
      });
      expect(result).toBe(true);
    });

    it('should return false if transfer is not indexed', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.isTransferIndexed('nonexistent');

      expect(result).toBe(false);
    });
  });
});
