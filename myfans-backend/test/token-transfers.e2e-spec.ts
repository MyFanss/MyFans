import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { TokenTransfersModule } from '../src/token-transfers/token-transfers.module';
import { TokenTransfer, TransferDirection } from '../src/token-transfers/entities/token-transfer.entity';
import { TokenTransfersService } from '../src/token-transfers/token-transfers.service';

describe('TokenTransfers E2E', () => {
  let app: INestApplication;
  let service: TokenTransfersService;

  const mockAddress1 = 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR';
  const mockAddress2 = 'GBXP4ACUQG4C5SQNXQD5LT4DLPTVHVGWTZL4VMWFPWK6BXV7L3TAZQ47';
  const mockTxHash = 'e2a6a5c4f3e4d3c2b1a0f9e8d7c6b5a4';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TokenTransfer],
          synchronize: true,
        }),
        TokenTransfersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    service = moduleFixture.get<TokenTransfersService>(TokenTransfersService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /token-transfers - Index Transfer', () => {
    it('should index a new transfer', async () => {
      const createDto = {
        sender_address: mockAddress1,
        receiver_address: mockAddress2,
        account_address: mockAddress1,
        amount: '100.500000',
        direction: TransferDirection.OUTGOING,
        tx_hash: mockTxHash,
        fee: '1.000000',
        net_amount: '99.500000',
      };

      const response = await request(app.getHttpServer())
        .post('/token-transfers')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        sender_address: mockAddress1,
        receiver_address: mockAddress2,
        amount: '100.500000',
        direction: TransferDirection.OUTGOING,
        tx_hash: mockTxHash,
      });
    });

    it('should reject invalid data', async () => {
      const invalidDto = {
        sender_address: mockAddress1,
        // missing required fields
      };

      await request(app.getHttpServer())
        .post('/token-transfers')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /token-transfers/account/:accountAddress', () => {
    beforeAll(async () => {
      // Index some test transfers
      await service.indexTransfer({
        sender_address: mockAddress1,
        receiver_address: mockAddress2,
        account_address: mockAddress1,
        amount: '100.000000',
        direction: TransferDirection.OUTGOING,
        tx_hash: 'tx001',
      });

      await service.indexTransfer({
        sender_address: mockAddress2,
        receiver_address: mockAddress1,
        account_address: mockAddress1,
        amount: '50.000000',
        direction: TransferDirection.INCOMING,
        tx_hash: 'tx002',
      });
    });

    it('should return transfer history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/account/${mockAddress1}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/account/${mockAddress1}`)
        .query({ limit: '1', offset: '0' })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /token-transfers/incoming/:accountAddress', () => {
    it('should return only incoming transfers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/incoming/${mockAddress1}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((transfer: TokenTransfer) => {
        expect(transfer.direction).toBe(TransferDirection.INCOMING);
        expect(transfer.receiver_address).toBe(mockAddress1);
      });
    });
  });

  describe('GET /token-transfers/outgoing/:accountAddress', () => {
    it('should return only outgoing transfers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/outgoing/${mockAddress1}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      response.body.data.forEach((transfer: TokenTransfer) => {
        expect(transfer.direction).toBe(TransferDirection.OUTGOING);
        expect(transfer.sender_address).toBe(mockAddress1);
      });
    });
  });

  describe('GET /token-transfers/tx/:txHash', () => {
    it('should return transfer by tx hash', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/tx/tx001`)
        .expect(200);

      expect(response.body).toHaveProperty('tx_hash', 'tx001');
    });

    it('should return 404 for non-existent transfer', async () => {
      await request(app.getHttpServer())
        .get(`/token-transfers/tx/nonexistent`)
        .expect(404);
    });
  });

  describe('GET /token-transfers/between/:addressA/:addressB', () => {
    it('should return transfers between two addresses', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/between/${mockAddress1}/${mockAddress2}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('GET /token-transfers/stats/:accountAddress', () => {
    it('should return account statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/stats/${mockAddress1}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalIncoming');
      expect(response.body).toHaveProperty('totalOutgoing');
      expect(response.body).toHaveProperty('incomingCount');
      expect(response.body).toHaveProperty('outgoingCount');
      expect(response.body).toHaveProperty('totalFeesPaid');
    });
  });

  describe('GET /token-transfers/exists/:txHash', () => {
    it('should return indexed status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/exists/tx001`)
        .expect(200);

      expect(response.body).toHaveProperty('indexed', true);
      expect(response.body).toHaveProperty('txHash');
    });

    it('should indicate non-indexed transfer', async () => {
      const response = await request(app.getHttpServer())
        .get(`/token-transfers/exists/nonexistent`)
        .expect(200);

      expect(response.body.indexed).toBe(false);
    });
  });
});
