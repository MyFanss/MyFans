import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
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

  const mockSocialLinksService = {
    createSocialLinks: jest.fn(),
    updateSocialLinks: jest.fn(),
    listSocialLinks: jest.fn(),
  };

  beforeEach(() => {
    controller = new SocialLinkController(
      mockSocialLinksService as unknown as SocialLinksService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  it('configures create with the expected throttling policy', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createHandler = controller.create;
    const limit: unknown = Reflect.getMetadata(THROTTLER_LIMIT + 'default', createHandler);
    const ttl: unknown = Reflect.getMetadata(THROTTLER_TTL + 'default', createHandler);

    it('update has @ApiResponse for 404', () => {
      const meta = Reflect.getMetadata(
        'swagger/apiResponse',
        SocialLinkController.prototype.update,
      );
      expect(meta?.['404']).toBeDefined();
    });
  });

  it('configures update with the expected throttling policy', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const updateHandler = controller.update;
    const limit: unknown = Reflect.getMetadata(THROTTLER_LIMIT + 'default', updateHandler);
    const ttl: unknown = Reflect.getMetadata(THROTTLER_TTL + 'default', updateHandler);

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

  describe('create', () => {
    it('delegates to createSocialLinks and returns its result', () => {
      const dto = { twitterHandle: 'johndoe' } as SocialLinksDto;
      const payload = { twitterHandle: 'johndoe' };
      mockSocialLinksService.createSocialLinks.mockReturnValue(payload);

      const result = controller.create(dto);

      expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
      expect(result).toBe(payload);
    });
  });

  describe('update', () => {
    it('delegates to updateSocialLinks with the user id and returns its result', () => {
      const dto = { instagramHandle: 'johndoe' } as SocialLinksDto;
      const payload = { instagramHandle: 'johndoe' };
      mockSocialLinksService.updateSocialLinks.mockReturnValue(payload);

      const result = controller.update('user-123', dto);

      expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith('user-123', dto);
      expect(result).toBe(payload);
    });
  });

  describe('list', () => {
    it('delegates to listSocialLinks with pagination params and returns its result', () => {
      const pagination = { page: 1, limit: 10 };
      const response = { data: [], page: 1, limit: 10, total: 0, hasMore: false };
      mockSocialLinksService.listSocialLinks.mockReturnValue(response);

      const result = controller.list(pagination as any);

      expect(mockSocialLinksService.listSocialLinks).toHaveBeenCalledWith(pagination);
      expect(result).toBe(response);
    });
  });

  // ─── Swagger / OpenAPI metadata ────────────────────────────────────────────

  describe('Swagger metadata', () => {
    // @ApiResponse stores metadata as an object keyed by status code, e.g.
    // { '200': { description: '...', type: Foo }, '400': { ... } }
    function getResponsesForMethod(
      methodName: 'list' | 'create' | 'update',
    ): Array<{ status: number; description: string; type?: unknown; schema?: unknown }> {
      const proto = SocialLinkController.prototype as Record<string, unknown>;
      const meta = Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        proto[methodName],
      ) as Record<string, { description: string; type?: unknown; schema?: unknown }> | undefined;
      if (!meta) return [];
      return Object.entries(meta).map(([statusKey, entry]) => ({
        status: Number(statusKey),
        ...entry,
      }));
    }

    it('controller carries the social-links API tag', () => {
      const tags = Reflect.getMetadata(
        DECORATORS.API_TAGS,
        SocialLinkController,
      ) as string[];
      expect(tags).toContain('social-links');
    });

    it('registers PaginatedResponseDto and SocialLinksListItemDto as extra models', () => {
      const extra = Reflect.getMetadata(
        DECORATORS.API_EXTRA_MODELS,
        SocialLinkController,
      ) as unknown[];
      expect(extra).toContain(PaginatedResponseDto);
      expect(extra).toContain(SocialLinksListItemDto);
    });

    describe('GET list endpoint', () => {
      it('has an ApiOperation summary', () => {
        const proto = SocialLinkController.prototype as Record<string, unknown>;
        const operation = Reflect.getMetadata(
          DECORATORS.API_OPERATION,
          proto['list'],
        ) as { summary: string };
        expect(operation.summary).toMatch(/list/i);
      });

      it('documents a 200 response with a paginated schema', () => {
        const responses = getResponsesForMethod('list');
        const ok = responses.find((r) => r.status === 200);
        expect(ok).toBeDefined();
        expect(ok?.schema).toBeDefined();
        expect(JSON.stringify(ok?.schema)).toContain('SocialLinksListItemDto');
      });

      it('documents a 400 response for invalid pagination', () => {
        const responses = getResponsesForMethod('list');
        expect(responses.some((r) => r.status === 400)).toBe(true);
      });
    });

    describe('POST create endpoint', () => {
      it('has an ApiOperation summary', () => {
        const proto = SocialLinkController.prototype as Record<string, unknown>;
        const operation = Reflect.getMetadata(
          DECORATORS.API_OPERATION,
          proto['create'],
        ) as { summary: string };
        expect(operation.summary).toMatch(/create/i);
      });

      it('documents a 201 response with SocialLinksResponseDto type', () => {
        const responses = getResponsesForMethod('create');
        const created = responses.find((r) => r.status === 201);
        expect(created).toBeDefined();
        expect(created?.type).toBe(SocialLinksResponseDto);
      });

      it('documents a 400 validation error response', () => {
        const responses = getResponsesForMethod('create');
        expect(responses.some((r) => r.status === 400)).toBe(true);
      });

      it('documents a 429 rate-limit response', () => {
        const responses = getResponsesForMethod('create');
        expect(responses.some((r) => r.status === 429)).toBe(true);
      });
    });

    describe('PATCH update endpoint', () => {
      it('has an ApiOperation summary', () => {
        const proto = SocialLinkController.prototype as Record<string, unknown>;
        const operation = Reflect.getMetadata(
          DECORATORS.API_OPERATION,
          proto['update'],
        ) as { summary: string };
        expect(operation.summary).toMatch(/update/i);
      });

      it('documents a 200 response with SocialLinksResponseDto type', () => {
        const responses = getResponsesForMethod('update');
        const ok = responses.find((r) => r.status === 200);
        expect(ok).toBeDefined();
        expect(ok?.type).toBe(SocialLinksResponseDto);
      });

      it('documents a 400 validation error response', () => {
        const responses = getResponsesForMethod('update');
        expect(responses.some((r) => r.status === 400)).toBe(true);
      });

      it('documents a 404 not-found response', () => {
        const responses = getResponsesForMethod('update');
        expect(responses.some((r) => r.status === 404)).toBe(true);
      });

      it('documents a 429 rate-limit response', () => {
        const responses = getResponsesForMethod('update');
        expect(responses.some((r) => r.status === 429)).toBe(true);
      });
    });
  });
});
