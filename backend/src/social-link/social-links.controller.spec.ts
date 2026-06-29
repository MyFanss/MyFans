import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';
import { PaginatedResponseDto } from '../common/dto';
import { SocialLinksListItem } from './social-links.service';

// ─── shared mock ────────────────────────────────────────────────────────────

const mockPaginatedResult: PaginatedResponseDto<SocialLinksListItem> = {
  data: [],
  cursor: null,
  limit: 20,
  nextCursor: null,
  hasMore: false,
  total: 0,
  page: 1,
  totalPages: 0,
};

const mockSocialLinksService = {
  extractUpdatePayload: jest
    .fn()
    .mockImplementation((dto: SocialLinksDto) => dto),
  createSocialLinks: jest
    .fn()
    .mockImplementation((dto: SocialLinksDto) => dto),
  updateSocialLinks: jest
    .fn()
    .mockImplementation((_id: string, dto: SocialLinksDto) => dto),
  listSocialLinks: jest.fn().mockReturnValue(mockPaginatedResult),
};

describe('SocialLinkController', () => {
  let controller: SocialLinkController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SocialLinkController(
      mockSocialLinksService as unknown as SocialLinksService,
    );
  });

  // ─── basic instantiation ──────────────────────────────────────────────────

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── guard & throttle metadata ────────────────────────────────────────────

  describe('guard and throttle metadata', () => {
    it('applies the throttler guard at the controller level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        SocialLinkController,
      ) as unknown as Array<new () => unknown>;
      expect(guards).toContain(ThrottlerGuard);
    });

    it('configures create with the expected throttling policy', () => {
      const createHandler = SocialLinkController.prototype.create;
      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', createHandler);
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'default', createHandler);
      expect(limit).toBe(5);
      expect(ttl).toBe(60000);
    });

    it('configures update with the expected throttling policy', () => {
      const updateHandler = SocialLinkController.prototype.update;
      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', updateHandler);
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'default', updateHandler);
      expect(limit).toBe(5);
      expect(ttl).toBe(60000);
    });

    it('list (read endpoint) has no @Throttle metadata', () => {
      const listHandler = SocialLinkController.prototype.list;
      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', listHandler);
      expect(limit).toBeUndefined();
    });
  });

  // ─── Swagger metadata ─────────────────────────────────────────────────────

  describe('Swagger metadata', () => {
    it('class has @ApiTags("social-links")', () => {
      const tags = Reflect.getMetadata('swagger/apiUseTags', SocialLinkController);
      expect(tags).toContain('social-links');
    });

    it.each(['list', 'create', 'update'])('%s has @ApiOperation metadata', (method) => {
      const meta = Reflect.getMetadata(
        'swagger/apiOperation',
        SocialLinkController.prototype[method],
      );
      expect(meta).toBeDefined();
      expect(meta.summary).toBeDefined();
      expect(meta.summary.length).toBeGreaterThan(0);
    });

    it('list has @ApiResponse for 200', () => {
      const meta = Reflect.getMetadata(
        'swagger/apiResponse',
        SocialLinkController.prototype.list,
      );
      expect(meta?.['200']).toBeDefined();
    });

    it('update has @ApiResponse for 404', () => {
      const meta = Reflect.getMetadata(
        'swagger/apiResponse',
        SocialLinkController.prototype.update,
      );
      expect(meta?.['404']).toBeDefined();
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates list pagination to the service', () => {
      const pagination = { page: 1, limit: 10 };

      const result = controller.list(pagination);

      expect(mockSocialLinksService.listSocialLinks).toHaveBeenCalledWith(pagination);
      expect(result).toMatchObject({ data: [], page: 1, limit: 20 });
    });

    it('returns exactly what the service returns', () => {
      const customResult = { ...mockPaginatedResult, total: 42, page: 3 };
      mockSocialLinksService.listSocialLinks.mockReturnValueOnce(customResult);

      const result = controller.list({ page: 3, limit: 20 });

      expect(result).toBe(customResult);
    });

    it('calls the service exactly once per request', () => {
      controller.list({ page: 1, limit: 20 });

      expect(mockSocialLinksService.listSocialLinks).toHaveBeenCalledTimes(1);
    });

    it('passes pagination object through to the service without modification', () => {
      const pagination = { page: 2, limit: 50 };

      controller.list(pagination);

      expect(mockSocialLinksService.listSocialLinks).toHaveBeenCalledWith(pagination);
    });

    it('propagates errors thrown by the service', () => {
      mockSocialLinksService.listSocialLinks.mockImplementationOnce(() => {
        throw new BadRequestException('Invalid pagination');
      });

      expect(() => controller.list({ page: -1, limit: 0 })).toThrow(BadRequestException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates create to the service happy path', () => {
      const dto = { twitterHandle: 'johndoe' };

      expect(controller.create(dto)).toEqual(dto);
      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
    });

    it('returns exactly what the service returns', () => {
      const dto: SocialLinksDto = { websiteUrl: 'https://twitter.com/user' };
      const serviceResult = { websiteUrl: 'https://twitter.com/user' };
      mockSocialLinksService.createSocialLinks.mockReturnValueOnce(serviceResult);

      const result = controller.create(dto);

      expect(result).toBe(serviceResult);
    });

    it('calls the service once with the exact dto', () => {
      const dto: SocialLinksDto = {
        twitterHandle: 'alice',
        instagramHandle: 'alice_photo',
      };

      controller.create(dto);

      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledTimes(1);
      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
    });

    it('works with all social link fields', () => {
      const dto: SocialLinksDto = {
        websiteUrl: 'https://twitter.com/user',
        twitterHandle: 'user',
        instagramHandle: 'user_ig',
        otherLink: 'https://linkedin.com/in/user',
      };

      controller.create(dto);

      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
    });

    it('works with a partial dto containing only instagramHandle', () => {
      const dto: SocialLinksDto = { instagramHandle: 'photos_only' };

      controller.create(dto);

      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
    });

    it('works with null fields to clear values', () => {
      const dto: SocialLinksDto = { twitterHandle: null, instagramHandle: null };

      controller.create(dto);

      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
    });

    it('propagates BadRequestException when the service rejects a disallowed domain', () => {
      mockSocialLinksService.createSocialLinks.mockImplementationOnce(() => {
        throw new BadRequestException(
          'website_url domain "evil.com" is not allowed',
        );
      });

      expect(() =>
        controller.create({ websiteUrl: 'https://evil.com' }),
      ).toThrow(BadRequestException);
    });

    it('propagates any unexpected error from the service', () => {
      mockSocialLinksService.createSocialLinks.mockImplementationOnce(() => {
        throw new Error('Database unreachable');
      });

      expect(() => controller.create({ twitterHandle: 'user' })).toThrow(
        'Database unreachable',
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates update to the service with the user id', () => {
      const dto = { instagramHandle: 'johndoe' };

      expect(controller.update('user-1', dto)).toEqual(dto);
      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });

    it('returns exactly what the service returns', () => {
      const dto: SocialLinksDto = { twitterHandle: 'updated' };
      const serviceResult = { twitterHandle: 'updated' };
      mockSocialLinksService.updateSocialLinks.mockReturnValueOnce(serviceResult);

      const result = controller.update('user-42', dto);

      expect(result).toBe(serviceResult);
    });

    it('passes the id and dto to the service without modification', () => {
      const id = 'a7f3c2d1-8b4e-4f5a-9c6d-1e2f3a4b5c6d';
      const dto: SocialLinksDto = { websiteUrl: 'https://twitter.com/creator' };

      controller.update(id, dto);

      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith(id, dto);
    });

    it('works with partial update (only websiteUrl)', () => {
      const dto: SocialLinksDto = { websiteUrl: 'https://twitter.com/user' };

      controller.update('user-1', dto);

      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });

    it('works with null fields to clear values on update', () => {
      const dto: SocialLinksDto = {
        twitterHandle: null,
        otherLink: null,
      };

      controller.update('user-1', dto);

      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });

    it('calls the service exactly once per request', () => {
      controller.update('user-1', { twitterHandle: 'user' });

      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledTimes(1);
    });

    it('propagates BadRequestException when the service rejects a disallowed domain', () => {
      mockSocialLinksService.updateSocialLinks.mockImplementationOnce(() => {
        throw new BadRequestException(
          'other_link domain "evil.com" is not allowed',
        );
      });

      expect(() =>
        controller.update('user-1', { otherLink: 'https://evil.com' }),
      ).toThrow(BadRequestException);
    });

    it('propagates NotFoundException when the underlying user does not exist', () => {
      mockSocialLinksService.updateSocialLinks.mockImplementationOnce(() => {
        throw new NotFoundException('User not found');
      });

      expect(() =>
        controller.update('nonexistent-id', { twitterHandle: 'user' }),
      ).toThrow(NotFoundException);
    });

    it('propagates any unexpected error from the service', () => {
      mockSocialLinksService.updateSocialLinks.mockImplementationOnce(() => {
        throw new Error('Database unreachable');
      });

      expect(() =>
        controller.update('user-1', { twitterHandle: 'user' }),
      ).toThrow('Database unreachable');
    });
  });

  // ─── service isolation ────────────────────────────────────────────────────

  describe('service isolation', () => {
    it('does not call update when create is invoked', () => {
      controller.create({ twitterHandle: 'user' });

      expect(mockSocialLinksService.updateSocialLinks).not.toHaveBeenCalled();
    });

    it('does not call create when update is invoked', () => {
      controller.update('user-1', { twitterHandle: 'user' });

      expect(mockSocialLinksService.createSocialLinks).not.toHaveBeenCalled();
    });

    it('does not call list when create is invoked', () => {
      controller.create({ twitterHandle: 'user' });

      expect(mockSocialLinksService.listSocialLinks).not.toHaveBeenCalled();
    });
  });
});
