import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';
import { SocialLinksResponseDto, SocialLinksListItemDto } from './user-profile.dto';
import { PaginatedResponseDto } from '../common/dto';

describe('SocialLinkController', () => {
  let controller: SocialLinkController;

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
    listSocialLinks: jest.fn().mockReturnValue({
      data: [],
      cursor: null,
      limit: 20,
      nextCursor: null,
      hasMore: false,
      total: 0,
      page: 1,
      totalPages: 0,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SocialLinkController(
      mockSocialLinksService as unknown as SocialLinksService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('applies the throttler guard at the controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      SocialLinkController,
    ) as unknown as Array<new () => unknown>;
    expect(guards).toContain(ThrottlerGuard);
  });

  it('configures create with the expected throttling policy', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createHandler = controller.create;
    const limit: unknown = Reflect.getMetadata(
      THROTTLER_LIMIT + 'default',
      createHandler,
    );
    const ttl: unknown = Reflect.getMetadata(
      THROTTLER_TTL + 'default',
      createHandler,
    );

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('configures update with the expected throttling policy', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const updateHandler = controller.update;
    const limit: unknown = Reflect.getMetadata(
      THROTTLER_LIMIT + 'default',
      updateHandler,
    );
    const ttl: unknown = Reflect.getMetadata(
      THROTTLER_TTL + 'default',
      updateHandler,
    );

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('delegates create to the service happy path', () => {
    const dto = { twitterHandle: 'johndoe' };

    expect(controller.create(dto)).toEqual(dto);
    expect(mockSocialLinksService.createSocialLinks).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service with the user id', () => {
    const dto = { instagramHandle: 'johndoe' };

    expect(controller.update('user-1', dto)).toEqual(dto);
    expect(mockSocialLinksService.updateSocialLinks).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('delegates list pagination to the service', () => {
    const pagination = { page: 1, limit: 10 };

    expect(controller.list(pagination)).toMatchObject({
      data: [],
      page: 1,
      limit: 20,
    });
    expect(mockSocialLinksService.listSocialLinks).toHaveBeenCalledWith(
      pagination,
    );
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
