import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: { isInitialized: boolean; query: jest.Mock };

  beforeEach(async () => {
    mockDataSource = { isInitialized: true, query: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: CACHE_MANAGER,
          useValue: { store: { client: null }, set: jest.fn(), del: jest.fn() },
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getHealthDb', () => {
    it('returns ok when DataSource is initialized and query succeeds', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await appController.getHealthDb();

      expect(result).toEqual({ status: 'ok', db: 'connected' });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns error when DataSource is not initialized', async () => {
      mockDataSource.isInitialized = false;

      const result = await appController.getHealthDb();

      expect(result).toEqual({
        status: 'error',
        db: 'disconnected',
        message: 'DataSource not initialized',
      });
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('returns error when query throws', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('connection refused'));

      const result = await appController.getHealthDb();

      expect(result).toEqual({
        status: 'error',
        db: 'disconnected',
        message: 'connection refused',
      });
    });
  });
});
