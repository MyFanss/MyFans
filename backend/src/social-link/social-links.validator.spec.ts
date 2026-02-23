import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  IsSafeUrlConstraint,
  IsSocialHandleConstraint,
  sanitizeUrl,
  normalizeHandle,
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

  it('passes with all fields valid', async () => {
    const errors = await validate_({
      websiteUrl: 'https://johndoe.com',
      twitterHandle: '@johndoe',
      instagramHandle: 'johndoe',
      otherLink: 'https://linktr.ee/johndoe',
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

  it('fails for invalid websiteUrl scheme', async () => {
    const errors = await validate_({ websiteUrl: 'javascript:alert(1)' });
    expect(errors.some((e) => e.property === 'websiteUrl')).toBe(true);
  });

  it('fails for invalid otherLink scheme', async () => {
    const errors = await validate_({ otherLink: 'ftp://files.example.com' });
    expect(errors.some((e) => e.property === 'otherLink')).toBe(true);
  });

  it('fails for twitterHandle with spaces', async () => {
    const errors = await validate_({ twitterHandle: 'john doe' });
    expect(errors.some((e) => e.property === 'twitterHandle')).toBe(true);
  });

  it('fails for instagramHandle with special chars', async () => {
    const errors = await validate_({ instagramHandle: 'john!@#$' });
    expect(errors.some((e) => e.property === 'instagramHandle')).toBe(true);
  });

  it('sanitizes websiteUrl via Transform', async () => {
    const dto = plainToInstance(SocialLinksDto, {
      websiteUrl: '  https://johndoe.com  ',
    });
    expect(dto.websiteUrl).toBe('https://johndoe.com/');
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
