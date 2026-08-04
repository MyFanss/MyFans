import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatorRegistrySyncService } from './creator-registry-sync.service';
import { CreatorOnchainMapping } from './entities/creator-onchain-mapping.entity';

type MockRepo = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
};

describe('CreatorRegistrySyncService', () => {
  let service: CreatorRegistrySyncService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((partial) => ({ ...partial })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorRegistrySyncService,
        { provide: getRepositoryToken(CreatorOnchainMapping), useValue: repo },
      ],
    }).compile();

    service = module.get(CreatorRegistrySyncService);
  });

  describe('syncOnOnboard', () => {
    it('creates a new mapping when none exists', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.syncOnOnboard('creator-1', 'GADDR1', '456');

      expect(repo.create).toHaveBeenCalledWith({ creator_id: 'creator-1' });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          stellar_address: 'GADDR1',
          onchain_creator_id: '456',
          drift_detected_at: null,
        }),
      );
      expect(result.onchain_creator_id).toBe('456');
    });

    it('updates the existing mapping and clears prior drift', async () => {
      repo.findOne.mockResolvedValue({
        creator_id: 'creator-1',
        stellar_address: 'GOLD',
        onchain_creator_id: '111',
        drift_detected_at: new Date('2024-01-01'),
      });

      const result = await service.syncOnOnboard('creator-1', 'GNEW', '999');

      expect(result.stellar_address).toBe('GNEW');
      expect(result.onchain_creator_id).toBe('999');
      expect(result.drift_detected_at).toBeNull();
    });
  });

  describe('reconcile', () => {
    it('flags drift when the chain read disagrees with the stored value', async () => {
      const mapping = {
        creator_id: 'creator-1',
        stellar_address: 'GADDR1',
        onchain_creator_id: '456',
        drift_detected_at: null,
      };
      repo.find.mockResolvedValue([mapping]);
      jest
        .spyOn(service as any, 'queryOnchainCreatorId')
        .mockResolvedValue('999');

      const result = await service.reconcile(false);

      expect(result.totalScanned).toBe(1);
      expect(result.driftFound).toBe(1);
      expect(result.records[0]).toEqual(
        expect.objectContaining({
          creatorId: 'creator-1',
          drift: true,
          chainOnchainId: '999',
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ drift_detected_at: expect.any(Date) }),
      );
    });

    it('does not persist drift markers in dry-run mode', async () => {
      const mapping = {
        creator_id: 'creator-1',
        stellar_address: 'GADDR1',
        onchain_creator_id: '456',
        drift_detected_at: null,
      };
      repo.find.mockResolvedValue([mapping]);
      jest
        .spyOn(service as any, 'queryOnchainCreatorId')
        .mockResolvedValue('999');

      const result = await service.reconcile(true);

      expect(result.dryRun).toBe(true);
      expect(result.driftFound).toBe(1);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('reports no drift when the chain agrees with the stored value', async () => {
      const mapping = {
        creator_id: 'creator-1',
        stellar_address: 'GADDR1',
        onchain_creator_id: '456',
        drift_detected_at: null,
      };
      repo.find.mockResolvedValue([mapping]);
      jest
        .spyOn(service as any, 'queryOnchainCreatorId')
        .mockResolvedValue('456');

      const result = await service.reconcile();

      expect(result.driftFound).toBe(0);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('counts errors from the chain read without aborting the scan', async () => {
      const mappings = [
        {
          creator_id: 'creator-1',
          stellar_address: 'GADDR1',
          onchain_creator_id: '456',
          drift_detected_at: null,
        },
        {
          creator_id: 'creator-2',
          stellar_address: 'GADDR2',
          onchain_creator_id: '789',
          drift_detected_at: null,
        },
      ];
      repo.find.mockResolvedValue(mappings);
      jest
        .spyOn(service as any, 'queryOnchainCreatorId')
        .mockRejectedValueOnce(new Error('rpc unavailable'))
        .mockResolvedValueOnce('789');

      const result = await service.reconcile();

      expect(result.totalScanned).toBe(2);
      expect(result.errors).toBe(1);
      expect(result.driftFound).toBe(0);
    });
  });
});
