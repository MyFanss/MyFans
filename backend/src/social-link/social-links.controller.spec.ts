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
    const limit: unknown = Reflect.getMetadata(THROTTLER_LIMIT + 'default', createHandler);
    const ttl: unknown = Reflect.getMetadata(THROTTLER_TTL + 'default', createHandler);

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('configures update with the expected throttling policy', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const updateHandler = controller.update;
    const limit: unknown = Reflect.getMetadata(THROTTLER_LIMIT + 'default', updateHandler);
    const ttl: unknown = Reflect.getMetadata(THROTTLER_TTL + 'default', updateHandler);

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
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
});
