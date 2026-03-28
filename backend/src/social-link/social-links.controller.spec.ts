import { ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { SocialLinkController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

describe('SocialLinkController', () => {
  let controller: SocialLinkController;

  const mockSocialLinksService = {
    extractUpdatePayload: jest.fn().mockImplementation((dto) => dto),
  };

  beforeEach(() => {
    controller = new SocialLinkController(
      mockSocialLinksService as unknown as SocialLinksService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('applies the throttler guard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', SocialLinkController) as Array<new () => unknown>;
    expect(guards).toContain(ThrottlerGuard);
  });

  it('configures create with the expected throttling policy', () => {
    const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', controller.create);
    const ttl = Reflect.getMetadata(THROTTLER_TTL + 'default', controller.create);

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('configures update with the expected throttling policy', () => {
    const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', controller.update);
    const ttl = Reflect.getMetadata(THROTTLER_TTL + 'default', controller.update);

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });
});
