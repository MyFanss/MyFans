import { SocialLinksService } from '../social-links.service';
import { SocialLinksResponseDto } from '../dto/user-profile.dto';

describe('SocialLinksService', () => {
  let service: SocialLinksService;

  beforeEach(() => {
    service = new SocialLinksService();
  });

  // ─── extractUpdatePayload ─────────────────────────────────────────────────

  describe('extractUpdatePayload', () => {
    it('extracts all provided social link fields', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: 'https://johndoe.com',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linktr.ee/johndoe',
      });

      expect(payload).toEqual({
        websiteUrl: 'https://johndoe.com',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linktr.ee/johndoe',
      });
    });

    it('maps undefined values to null', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: undefined,
        twitterHandle: undefined,
      });

      expect(payload.websiteUrl).toBeNull();
      expect(payload.twitterHandle).toBeNull();
    });

    it('does not include keys not present in the dto', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: 'https://example.com',
        // twitterHandle, instagramHandle, otherLink not passed
      });

      expect(Object.keys(payload)).toEqual(['websiteUrl']);
    });

    it('preserves explicit null values', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: null,
        twitterHandle: null,
      });

      expect(payload.websiteUrl).toBeNull();
      expect(payload.twitterHandle).toBeNull();
    });
  });

  // ─── toResponseDto ────────────────────────────────────────────────────────

  describe('toResponseDto', () => {
    it('maps all fields from entity', () => {
      const entity = {
        websiteUrl: 'https://johndoe.com',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linktr.ee/johndoe',
      };

      const dto: SocialLinksResponseDto = service.toResponseDto(entity);

      expect(dto.websiteUrl).toBe('https://johndoe.com');
      expect(dto.twitterHandle).toBe('johndoe');
      expect(dto.instagramHandle).toBe('johndoe');
      expect(dto.otherLink).toBe('https://linktr.ee/johndoe');
    });

    it('returns null for missing entity fields', () => {
      const dto = service.toResponseDto({});

      expect(dto.websiteUrl).toBeNull();
      expect(dto.twitterHandle).toBeNull();
      expect(dto.instagramHandle).toBeNull();
      expect(dto.otherLink).toBeNull();
    });

    it('returns null when entity fields are explicitly null', () => {
      const dto = service.toResponseDto({
        websiteUrl: null,
        twitterHandle: null,
        instagramHandle: null,
        otherLink: null,
      });

      expect(dto.websiteUrl).toBeNull();
      expect(dto.twitterHandle).toBeNull();
      expect(dto.instagramHandle).toBeNull();
      expect(dto.otherLink).toBeNull();
    });
  });
});
