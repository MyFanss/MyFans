import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

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
});
