import { redactString, redactError, STRING_REDACTED } from './redact-string.util';

describe('redactString', () => {
  it('redacts a JWT embedded in free text', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYEyIQyktA1B';
    const input = `Invalid signature for token ${jwt}`;
    expect(redactString(input)).toBe(`Invalid signature for token ${STRING_REDACTED}`);
  });

  it('redacts an Authorization Bearer header value', () => {
    const input = 'rejected request with Authorization: Bearer abc123.def456xyz';
    expect(redactString(input)).toContain(`Bearer ${STRING_REDACTED}`);
    expect(redactString(input)).not.toContain('abc123');
  });

  it('redacts webhookSecret=value pairs', () => {
    const input = 'signature mismatch, webhookSecret=whsec_1234567890abcdef expected';
    const out = redactString(input);
    expect(out).not.toContain('whsec_1234567890abcdef');
    expect(out).toContain(STRING_REDACTED);
  });

  it('leaves ordinary text untouched', () => {
    const input = 'user not found for id 42';
    expect(redactString(input)).toBe(input);
  });

  it('handles empty and non-string-safe input gracefully', () => {
    expect(redactString('')).toBe('');
  });
});

describe('redactError', () => {
  it('redacts secrets out of an Error message and stack', () => {
    const err = new Error('token=super-secret-value rejected');
    const result = redactError(err);
    expect(result.message).not.toContain('super-secret-value');
  });

  it('stringifies and redacts non-Error values', () => {
    const result = redactError('token=abcdef123456');
    expect(result.message).not.toContain('abcdef123456');
  });
});
