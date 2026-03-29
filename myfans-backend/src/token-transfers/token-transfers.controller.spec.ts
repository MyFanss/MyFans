import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TokenTransfersController } from './token-transfers.controller';
import { TokenTransfersService } from './token-transfers.service';
import { TokenTransfer, TransferDirection } from './entities/token-transfer.entity';

describe('TokenTransfersController', () => {
  let controller: TokenTransfersController;
  let service: TokenTransfersService;
  let module: TestingModule;

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
    const mockService = {
      indexTransfer: jest.fn(),
      getTransferHistory: jest.fn(),
      getIncomingTransfers: jest.fn(),
      getOutgoingTransfers: jest.fn(),
      getTransferByTxHash: jest.fn(),
      getTransfersBetween: jest.fn(),
      getAccountStats: jest.fn(),
      isTransferIndexed: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [TokenTransfersController],
      providers: [
        {
          provide: TokenTransfersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TokenTransfersController>(TokenTransfersController);
    service = module.get<TokenTransfersService>(TokenTransfersService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('indexTransfer (POST)', () => {
    it('should index a new transfer', async () => {
      const dto = {
        sender_address: mockTokenTransfer.sender_address,
        receiver_address: mockTokenTransfer.receiver_address,
        account_address: mockTokenTransfer.account_address,
        amount: '100.000000',
        direction: TransferDirection.OUTGOING,
        tx_hash: mockTokenTransfer.tx_hash,
      };

      jest.spyOn(service, 'indexTransfer').mockResolvedValue(mockTokenTransfer);

      const result = await controller.indexTransfer(dto);

      expect(service.indexTransfer).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokenTransfer);
    });

    it('should handle service errors', async () => {
      const dto = {
        sender_address: mockTokenTransfer.sender_address,
        receiver_address: mockTokenTransfer.receiver_address,
        account_address: mockTokenTransfer.account_address,
        amount: '100.000000',
        direction: TransferDirection.OUTGOING,
        tx_hash: mockTokenTransfer.tx_hash,
      };

      jest
        .spyOn(service, 'indexTransfer')
        .mockRejectedValue(new Error('Database error'));

      await expect(controller.indexTransfer(dto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getTransferHistory (GET /account/:accountAddress)', () => {
    it('should return transfer history with defaults', async () => {
      const mockResponse = { data: [mockTokenTransfer], total: 1 };
      jest
        .spyOn(service, 'getTransferHistory')
        .mockResolvedValue(mockResponse);

      const result = await controller.getTransferHistory(
        mockTokenTransfer.account_address,
      );

      expect(service.getTransferHistory).toHaveBeenCalledWith(
        mockTokenTransfer.account_address,
        50,
        0,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should apply query parameters', async () => {
      const mockResponse = { data: [mockTokenTransfer], total: 1 };
      jest
        .spyOn(service, 'getTransferHistory')
        .mockResolvedValue(mockResponse);

      await controller.getTransferHistory(
        mockTokenTransfer.account_address,
        '25',
        '50',
      );

      expect(service.getTransferHistory).toHaveBeenCalledWith(
        mockTokenTransfer.account_address,
        25,
        50,
      );
    });

    it('should cap limit at 200', async () => {
      const mockResponse = { data: [], total: 0 };
      jest
        .spyOn(service, 'getTransferHistory')
        .mockResolvedValue(mockResponse);

      await controller.getTransferHistory(
        mockTokenTransfer.account_address,
        '500',
        '0',
      );

      expect(service.getTransferHistory).toHaveBeenCalledWith(
        mockTokenTransfer.account_address,
        200,
        0,
      );
    });

    it('should handle invalid limit gracefully', async () => {
      const mockResponse = { data: [], total: 0 };
      jest
        .spyOn(service, 'getTransferHistory')
        .mockResolvedValue(mockResponse);

      await controller.getTransferHistory(
        mockTokenTransfer.account_address,
        'invalid',
        'invalid',
      );

      expect(service.getTransferHistory).toHaveBeenCalledWith(
        mockTokenTransfer.account_address,
        50,
        0,
      );
    });
  });

  describe('getIncomingTransfers (GET /incoming/:accountAddress)', () => {
    it('should return incoming transfers', async () => {
      const mockResponse = { data: [mockTokenTransfer], total: 1 };
      jest
        .spyOn(service, 'getIncomingTransfers')
        .mockResolvedValue(mockResponse);

      const result = await controller.getIncomingTransfers(
        mockTokenTransfer.receiver_address,
      );

      expect(service.getIncomingTransfers).toHaveBeenCalledWith(
        mockTokenTransfer.receiver_address,
        50,
        0,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getOutgoingTransfers (GET /outgoing/:accountAddress)', () => {
    it('should return outgoing transfers', async () => {
      const mockResponse = { data: [mockTokenTransfer], total: 1 };
      jest
        .spyOn(service, 'getOutgoingTransfers')
        .mockResolvedValue(mockResponse);

      const result = await controller.getOutgoingTransfers(
        mockTokenTransfer.sender_address,
      );

      expect(service.getOutgoingTransfers).toHaveBeenCalledWith(
        mockTokenTransfer.sender_address,
        50,
        0,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTransferByTxHash (GET /tx/:txHash)', () => {
    it('should return transfer by tx hash', async () => {
      jest
        .spyOn(service, 'getTransferByTxHash')
        .mockResolvedValue(mockTokenTransfer);

      const result = await controller.getTransferByTxHash(
        mockTokenTransfer.tx_hash,
      );

      expect(service.getTransferByTxHash).toHaveBeenCalledWith(
        mockTokenTransfer.tx_hash,
      );
      expect(result).toEqual(mockTokenTransfer);
    });

    it('should throw 404 if transfer not found', async () => {
      jest.spyOn(service, 'getTransferByTxHash').mockResolvedValue(null);

      await expect(
        controller.getTransferByTxHash('nonexistent'),
      ).rejects.toThrow(new HttpException('Transfer not found', HttpStatus.NOT_FOUND));
    });
  });

  describe('getTransfersBetween (GET /between/:addressA/:addressB)', () => {
    it('should return transfers between two addresses', async () => {
      const mockResponse = { data: [mockTokenTransfer], total: 1 };
      jest
        .spyOn(service, 'getTransfersBetween')
        .mockResolvedValue(mockResponse);

      const result = await controller.getTransfersBetween(
        mockTokenTransfer.sender_address,
        mockTokenTransfer.receiver_address,
      );

      expect(service.getTransfersBetween).toHaveBeenCalledWith(
        mockTokenTransfer.sender_address,
        mockTokenTransfer.receiver_address,
        50,
        0,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAccountStats (GET /stats/:accountAddress)', () => {
    it('should return account statistics', async () => {
      const mockStats = {
        totalIncoming: '500.000000',
        totalOutgoing: '250.000000',
        incomingCount: 5,
        outgoingCount: 3,
        totalFeesPaid: '5.000000',
      };

      jest.spyOn(service, 'getAccountStats').mockResolvedValue(mockStats);

      const result = await controller.getAccountStats(
        mockTokenTransfer.account_address,
      );

      expect(service.getAccountStats).toHaveBeenCalledWith(
        mockTokenTransfer.account_address,
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('isTransferIndexed (GET /exists/:txHash)', () => {
    it('should return indexed status', async () => {
      const mockResponse = { indexed: true, txHash: mockTokenTransfer.tx_hash };
      jest.spyOn(service, 'isTransferIndexed').mockResolvedValue(true);

      const result = await controller.isTransferIndexed(
        mockTokenTransfer.tx_hash,
      );

      expect(service.isTransferIndexed).toHaveBeenCalledWith(
        mockTokenTransfer.tx_hash,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should indicate non-indexed transfer', async () => {
      jest.spyOn(service, 'isTransferIndexed').mockResolvedValue(false);

      const result = await controller.isTransferIndexed('nonexistent');

      expect(result.indexed).toBe(false);
    });
  });
});
