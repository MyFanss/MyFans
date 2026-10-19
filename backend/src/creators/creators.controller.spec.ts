import { Test } from '@nestjs/testing';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let service: {
    listCreators: jest.Mock;
    getCreatorAccess: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listCreators: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getCreatorAccess: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CreatorsController],
      providers: [{ provide: CreatorsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(CreatorsController);
  });

  describe('listCreators', () => {
    it('defaults limit to 12 when missing', async () => {
      await controller.listCreators(undefined, undefined);
      expect(service.listCreators).toHaveBeenCalledWith(12, null);
    });

    it('defaults limit to 12 when NaN', async () => {
      await controller.listCreators('not-a-number', undefined);
      expect(service.listCreators).toHaveBeenCalledWith(12, null);
    });

    it('clamps limit below 1 up to 1', async () => {
      await controller.listCreators('0', undefined);
      expect(service.listCreators).toHaveBeenCalledWith(1, null);

      service.listCreators.mockClear();
      await controller.listCreators('-5', undefined);
      expect(service.listCreators).toHaveBeenCalledWith(1, null);
    });

    it('clamps limit above 50 down to 50', async () => {
      await controller.listCreators('999', undefined);
      expect(service.listCreators).toHaveBeenCalledWith(50, null);
    });

    it('passes through a limit within range', async () => {
      await controller.listCreators('25', undefined);
      expect(service.listCreators).toHaveBeenCalledWith(25, null);
    });

    it('passes q as null when shorter than 2 characters', async () => {
      await controller.listCreators(undefined, 'a');
      expect(service.listCreators).toHaveBeenCalledWith(12, null);
    });

    it('trims q before evaluating length', async () => {
      await controller.listCreators(undefined, '  a  ');
      expect(service.listCreators).toHaveBeenCalledWith(12, null);
    });

    it('passes trimmed q when at least 2 characters', async () => {
      await controller.listCreators(undefined, '  ab  ');
      expect(service.listCreators).toHaveBeenCalledWith(12, 'ab');
    });

    it('truncates q longer than 100 characters to 100', async () => {
      const longQuery = 'x'.repeat(150);
      await controller.listCreators(undefined, longQuery);
      expect(service.listCreators).toHaveBeenCalledWith(12, 'x'.repeat(100));
    });
  });

  describe('getCreatorAccess', () => {
    it('returns contentCid null when hasAccess is false', async () => {
      service.getCreatorAccess.mockResolvedValue({
        hasAccess: false,
        contentCid: 'bafy-some-cid',
      });

      const result = await controller.getCreatorAccess('creator-1');

      expect(service.getCreatorAccess).toHaveBeenCalledWith('creator-1');
      expect(result.contentCid).toBeNull();
    });

    it('returns the CID when hasAccess is true', async () => {
      service.getCreatorAccess.mockResolvedValue({
        hasAccess: true,
        contentCid: 'bafy-some-cid',
      });

      const result = await controller.getCreatorAccess('creator-1');

      expect(service.getCreatorAccess).toHaveBeenCalledWith('creator-1');
      expect(result.contentCid).toBe('bafy-some-cid');
    });
  });
});
