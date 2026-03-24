import { logError } from '@/lib/logger';

describe('logError', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.NODE_ENV = 'test';
  });

  it('logs a JSON entry with the provided correlationId', () => {
    logError({ message: 'test error', correlationId: 'corr-123' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [prefix, json] = consoleSpy.mock.calls[0];
    expect(prefix).toBe('[MyFans]');
    const parsed = JSON.parse(json);
    expect(parsed.correlationId).toBe('corr-123');
    expect(parsed.message).toBe('test error');
    expect(parsed.level).toBe('error');
    expect(parsed.timestamp).toBeDefined();
  });

  it('generates a session correlationId when none is provided', () => {
    logError({ message: 'no corr id' });
    const [, json] = consoleSpy.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.correlationId).toBeTruthy();
    expect(typeof parsed.correlationId).toBe('string');
  });

  it('includes context when provided', () => {
    logError({ message: 'ctx test', correlationId: 'x', context: { segment: 'dashboard' } });
    const [, json] = consoleSpy.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.context).toEqual({ segment: 'dashboard' });
  });

  it('does not log in test environment', () => {
    process.env.NODE_ENV = 'test';
    logError({ message: 'silent' });
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
