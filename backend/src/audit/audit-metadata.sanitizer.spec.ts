import { sanitizeAuditMetadata } from './audit-metadata.sanitizer';

describe('sanitizeAuditMetadata', () => {
  it('redacts sensitive keys', () => {
    const out = sanitizeAuditMetadata({
      user: 'ok',
      password: 'super-secret',
      nested: { apiKey: 'x', safe: 1 },
    });
    expect(out?.password).toBe('[REDACTED]');
    expect(out?.nested).toEqual({ apiKey: '[REDACTED]', safe: 1 });
  });

  it('redacts JWT-shaped strings', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const out = sanitizeAuditMetadata({ token: jwt });
    expect(out?.token).toBe('[REDACTED_JWT]');
  });
});
