import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  IsSafeUrlConstraint,
  IsSocialHandleConstraint,
  IsAllowedDomainConstraint,
  sanitizeUrl,
  normalizeHandle,
  isAllowedDomain,
  ALLOWED_DOMAINS,
} from './social-links.validator';
import { SocialLinksDto } from './social-links.dto';

// ─── IsSafeUrlConstraint ─────────────────────────────────────────────────────

describe('IsSafeUrlConstraint', () => {
  let constraint: IsSafeUrlConstraint;

  beforeEach(() => {
    constraint = new IsSafeUrlConstraint();
  });

  it('passes for https URLs', () => {
    expect(constraint.validate('https://example.com')).toBe(true);
  });

  it('passes for http URLs', () => {
    expect(constraint.validate('http://example.com')).toBe(true);
  });

  it('passes for null (optional field)', () => {
    expect(constraint.validate(null)).toBe(true);
  });

  it('passes for undefined (optional field)', () => {
    expect(constraint.validate(undefined)).toBe(true);
  });

  it('passes for empty string (optional field)', () => {
    expect(constraint.validate('')).toBe(true);
  });

  it('fails for javascript: scheme', () => {
    expect(constraint.validate('javascript:alert(1)')).toBe(false);
  });

  it('fails for data: scheme', () => {
    expect(constraint.validate('data:text/html,<h1>XSS</h1>')).toBe(false);
  });

  it('fails for ftp: scheme', () => {
    expect(constraint.validate('ftp://files.example.com')).toBe(false);
  });

  it('fails for plain strings', () => {
    expect(constraint.validate('not-a-url')).toBe(false);
  });

  it('fails for non-string values', () => {
    expect(constraint.validate(12345)).toBe(false);
  });

  it('returns a descriptive defaultMessage', () => {
    expect(constraint.defaultMessage()).toMatch(/http|https/);
  });
});

// ─── IsAllowedDomainConstraint ───────────────────────────────────────────────

describe('IsAllowedDomainConstraint', () => {
  let constraint: IsAllowedDomainConstraint;

  beforeEach(() => {
    constraint = new IsAllowedDomainConstraint();
  });

  // ── Allowed domains ──

  it('passes for https://twitter.com', () => {
    expect(constraint.validate('https://twitter.com')).toBe(true);
  });

  it('passes for https://instagram.com/profile', () => {
    expect(constraint.validate('https://instagram.com/profile')).toBe(true);
  });

  it('passes for https://linkedin.com/in/johndoe', () => {
    expect(constraint.validate('https://linkedin.com/in/johndoe')).toBe(true);
  });

  it('passes for http://twitter.com (http scheme)', () => {
    expect(constraint.validate('http://twitter.com')).toBe(true);
  });

  it('passes for subdomain www.twitter.com', () => {
    expect(constraint.validate('https://www.twitter.com/page')).toBe(true);
  });

  it('passes for subdomain m.instagram.com', () => {
    expect(constraint.validate('https://m.instagram.com/user')).toBe(true);
  });

  it('passes for URL with trailing slash', () => {
    expect(constraint.validate('https://twitter.com/')).toBe(true);
  });

  it('passes for URL with path and query string', () => {
    expect(constraint.validate('https://linkedin.com/in/johndoe?ref=share')).toBe(true);
  });

  // ── Optional fields ──

  it('passes for null (optional)', () => {
    expect(constraint.validate(null)).toBe(true);
  });

  it('passes for undefined (optional)', () => {
    expect(constraint.validate(undefined)).toBe(true);
  });

  it('passes for empty string (optional)', () => {
    expect(constraint.validate('')).toBe(true);
  });

  // ── Disallowed domains ──

  it('fails for disallowed domain example.com', () => {
    expect(constraint.validate('https://example.com')).toBe(false);
  });

  it('fails for disallowed domain facebook.com', () => {
    expect(constraint.validate('https://facebook.com/page')).toBe(false);
  });

  it('fails for disallowed domain evil.com', () => {
    expect(constraint.validate('https://evil.com/phish')).toBe(false);
  });

  it('fails for domain that contains allowed domain as substring (nottwitter.com)', () => {
    expect(constraint.validate('https://nottwitter.com')).toBe(false);
  });

  it('fails for domain that contains allowed domain as substring (myinstagram.com)', () => {
    expect(constraint.validate('https://myinstagram.com')).toBe(false);
  });

  // ── Invalid URL formats ──

  it('fails for plain string (not a URL)', () => {
    expect(constraint.validate('not-a-url')).toBe(false);
  });

  it('fails for non-string values', () => {
    expect(constraint.validate(12345)).toBe(false);
  });

  it('fails for ftp: scheme even on allowed domain', () => {
    expect(constraint.validate('ftp://twitter.com')).toBe(false);
  });

  it('returns a descriptive defaultMessage listing allowed domains', () => {
    const message = constraint.defaultMessage();
    expect(message).toContain('twitter.com');
    expect(message).toContain('instagram.com');
    expect(message).toContain('linkedin.com');
  });
});

// ─── isAllowedDomain (standalone utility) ─────────────────────────────────────

describe('isAllowedDomain', () => {
  it('returns true for allowed domain twitter.com', () => {
    expect(isAllowedDomain('https://twitter.com/user')).toBe(true);
  });

  it('returns true for allowed domain instagram.com', () => {
    expect(isAllowedDomain('https://instagram.com/profile')).toBe(true);
  });

  it('returns true for allowed domain linkedin.com', () => {
    expect(isAllowedDomain('https://linkedin.com/in/person')).toBe(true);
  });

  it('returns true for subdomain www.linkedin.com', () => {
    expect(isAllowedDomain('https://www.linkedin.com/in/person')).toBe(true);
  });

  it('returns true for http scheme on allowed domain', () => {
    expect(isAllowedDomain('http://instagram.com/user')).toBe(true);
  });

  it('returns true for null (optional)', () => {
    expect(isAllowedDomain(null)).toBe(true);
  });

  it('returns true for undefined (optional)', () => {
    expect(isAllowedDomain(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isAllowedDomain('')).toBe(true);
  });

  it('returns false for disallowed domain', () => {
    expect(isAllowedDomain('https://evil.com')).toBe(false);
  });

  it('returns false for disallowed domain facebook.com', () => {
    expect(isAllowedDomain('https://facebook.com/page')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isAllowedDomain('not-a-url')).toBe(false);
  });

  it('returns false for domain containing allowed domain as substring', () => {
    expect(isAllowedDomain('https://nottwitter.com')).toBe(false);
  });
});

// ─── ALLOWED_DOMAINS constant ────────────────────────────────────────────────

describe('ALLOWED_DOMAINS', () => {
  it('contains twitter.com', () => {
    expect(ALLOWED_DOMAINS).toContain('twitter.com');
  });

  it('contains instagram.com', () => {
    expect(ALLOWED_DOMAINS).toContain('instagram.com');
  });

  it('contains linkedin.com', () => {
    expect(ALLOWED_DOMAINS).toContain('linkedin.com');
  });

  it('has exactly 3 entries', () => {
    expect(ALLOWED_DOMAINS).toHaveLength(3);
  });
});

// ─── IsSocialHandleConstraint ─────────────────────────────────────────────────

describe('IsSocialHandleConstraint', () => {
  let constraint: IsSocialHandleConstraint;

  beforeEach(() => {
    constraint = new IsSocialHandleConstraint();
  });

  it('passes for plain handle', () => {
    expect(constraint.validate('johndoe')).toBe(true);
  });

  it('passes for handle with @ prefix', () => {
    expect(constraint.validate('@johndoe')).toBe(true);
  });

  it('passes for handle with underscores', () => {
    expect(constraint.validate('john_doe_123')).toBe(true);
  });

  it('passes for handle with dots', () => {
    expect(constraint.validate('john.doe')).toBe(true);
  });

  it('passes for null (optional)', () => {
    expect(constraint.validate(null)).toBe(true);
  });

  it('passes for empty string (optional)', () => {
    expect(constraint.validate('')).toBe(true);
  });

  it('fails for handle with spaces', () => {
    expect(constraint.validate('john doe')).toBe(false);
  });

  it('fails for handle with special chars', () => {
    expect(constraint.validate('john#doe!')).toBe(false);
  });

  it('fails for non-string values', () => {
    expect(constraint.validate(999)).toBe(false);
  });
});

// ─── sanitizeUrl ─────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  it('returns cleaned https URL', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('returns null for javascript: scheme', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns null for data: scheme', () => {
    expect(sanitizeUrl('data:text/html,xss')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(sanitizeUrl(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeUrl('')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(sanitizeUrl('not-a-url')).toBeNull();
  });

  it('strips trailing whitespace before parsing', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com/');
  });
});

// ─── normalizeHandle ──────────────────────────────────────────────────────────

describe('normalizeHandle', () => {
  it('strips @ prefix and lowercases', () => {
    expect(normalizeHandle('@JohnDoe')).toBe('johndoe');
  });

  it('lowercases without @ prefix', () => {
    expect(normalizeHandle('JohnDoe')).toBe('johndoe');
  });

  it('returns null for null input', () => {
    expect(normalizeHandle(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeHandle('')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(normalizeHandle('   ')).toBeNull();
  });
});

// ─── SocialLinksDto class-validator integration ───────────────────────────────

describe('SocialLinksDto validation', () => {
  async function validate_(plain: object) {
    const dto = plainToInstance(SocialLinksDto, plain);
    return validate(dto);
  }

  it('passes with all fields valid on allowed domains', async () => {
    const errors = await validate_({
      websiteUrl: 'https://twitter.com/johndoe',
      twitterHandle: '@johndoe',
      instagramHandle: 'johndoe',
      otherLink: 'https://linkedin.com/in/johndoe',
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with all fields empty/null', async () => {
    const errors = await validate_({
      websiteUrl: null,
      twitterHandle: null,
      instagramHandle: null,
      otherLink: null,
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with no fields provided (all optional)', async () => {
    const errors = await validate_({});
    expect(errors).toHaveLength(0);
  });

  it('passes with subdomain www.instagram.com', async () => {
    const errors = await validate_({
      websiteUrl: 'https://www.instagram.com/profile',
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with http scheme on allowed domain', async () => {
    const errors = await validate_({
      websiteUrl: 'http://twitter.com/page',
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with trailing slash', async () => {
    const errors = await validate_({
      otherLink: 'https://linkedin.com/',
    });
    expect(errors).toHaveLength(0);
  });

  // ── Invalid URL format ──

  it('fails for invalid websiteUrl scheme', async () => {
    const errors = await validate_({ websiteUrl: 'javascript:alert(1)' });
    expect(errors.some((e) => e.property === 'websiteUrl')).toBe(true);
  });

  it('fails for invalid otherLink scheme', async () => {
    const errors = await validate_({ otherLink: 'ftp://files.example.com' });
    expect(errors.some((e) => e.property === 'otherLink')).toBe(true);
  });

  it('fails for plain string websiteUrl', async () => {
    const errors = await validate_({ websiteUrl: 'not-a-url' });
    expect(errors.some((e) => e.property === 'websiteUrl')).toBe(true);
  });

  // ── Disallowed domain ──

  it('fails for websiteUrl on disallowed domain example.com', async () => {
    const errors = await validate_({ websiteUrl: 'https://example.com' });
    expect(errors.some((e) => e.property === 'websiteUrl')).toBe(true);
  });

  it('error message mentions "not allowed" for disallowed websiteUrl domain', async () => {
    const errors = await validate_({ websiteUrl: 'https://facebook.com' });
    const websiteErrors = errors.find((e) => e.property === 'websiteUrl');
    const messages = Object.values(websiteErrors?.constraints || {});
    expect(messages.some((m) => /not allowed/i.test(m))).toBe(true);
  });

  it('fails for otherLink on disallowed domain evil.com', async () => {
    const errors = await validate_({ otherLink: 'https://evil.com/page' });
    expect(errors.some((e) => e.property === 'otherLink')).toBe(true);
  });

  it('fails for domain containing allowed domain as substring', async () => {
    const errors = await validate_({ websiteUrl: 'https://nottwitter.com' });
    expect(errors.some((e) => e.property === 'websiteUrl')).toBe(true);
  });

  // ── Handle validation ──

  it('fails for twitterHandle with spaces', async () => {
    const errors = await validate_({ twitterHandle: 'john doe' });
    expect(errors.some((e) => e.property === 'twitterHandle')).toBe(true);
  });

  it('fails for instagramHandle with special chars', async () => {
    const errors = await validate_({ instagramHandle: 'john!@#$' });
    expect(errors.some((e) => e.property === 'instagramHandle')).toBe(true);
  });

  // ── Transform integration ──

  it('sanitizes websiteUrl via Transform', async () => {
    const dto = plainToInstance(SocialLinksDto, {
      websiteUrl: '  https://twitter.com/page  ',
    });
    expect(dto.websiteUrl).toBe('https://twitter.com/page');
  });

  it('normalizes twitterHandle via Transform', async () => {
    const dto = plainToInstance(SocialLinksDto, { twitterHandle: '@JohnDoe' });
    expect(dto.twitterHandle).toBe('johndoe');
  });

  it('normalizes instagramHandle via Transform', async () => {
    const dto = plainToInstance(SocialLinksDto, { instagramHandle: '@MyUser' });
    expect(dto.instagramHandle).toBe('myuser');
  });
});
