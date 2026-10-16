import {
  backoffDelay,
  envInt,
  resolveRpcUrl,
  retryRead,
  useMockRpc,
  withTimeout,
} from './check-contracts';

const ENV_KEYS = [
  'RPC_MAX_ATTEMPTS',
  'RPC_BASE_DELAY_MS',
  'RPC_MAX_DELAY_MS',
  'RPC_TIMEOUT_MS',
  'USE_MOCK_RPC',
  'RPC_MOCK',
  'SOROBAN_RPC_URL',
];

const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('envInt', () => {
  it('falls back when the variable is missing', () => {
    delete process.env.RPC_MAX_ATTEMPTS;
    expect(envInt('RPC_MAX_ATTEMPTS', 7)).toBe(7);
  });

  it('falls back on non-positive input', () => {
    process.env.RPC_MAX_ATTEMPTS = '0';
    expect(envInt('RPC_MAX_ATTEMPTS', 7)).toBe(7);
    process.env.RPC_MAX_ATTEMPTS = '-3';
    expect(envInt('RPC_MAX_ATTEMPTS', 7)).toBe(7);
  });

  it('falls back on non-numeric input', () => {
    process.env.RPC_MAX_ATTEMPTS = 'not-a-number';
    expect(envInt('RPC_MAX_ATTEMPTS', 7)).toBe(7);
  });

  it('parses a valid positive integer', () => {
    process.env.RPC_MAX_ATTEMPTS = '9';
    expect(envInt('RPC_MAX_ATTEMPTS', 7)).toBe(9);
  });
});

describe('backoffDelay', () => {
  it('stays within the documented bound for attempts 1..5', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999999);
    const base = 250;
    const max = 4000;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const cap = Math.min(max, base * Math.pow(2, attempt - 1));
      const delay = backoffDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(cap);
    }
  });

  it('is deterministic when Math.random is stubbed', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(backoffDelay(1)).toBe(Math.floor(0.5 * 250));
  });
});

describe('withTimeout', () => {
  it('rejects with a message containing the timeout and label when the promise never settles', async () => {
    jest.useFakeTimers();
    const never = new Promise<never>(() => {});
    const pending = withTimeout(never, 'getHealth', 1234);
    const assertion = expect(pending).rejects.toThrow(/1234ms/);
    jest.advanceTimersByTime(1234);
    await assertion;
    await expect(withTimeout(never, 'getHealth', 1234)).rejects.toThrow(/getHealth/);
  });

  it('resolves with the value when the promise settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 'getHealth', 1000)).resolves.toBe('ok');
  });
});

describe('retryRead', () => {
  it('calls the operation exactly RPC_MAX_ATTEMPTS times and rethrows the last error', async () => {
    jest.useFakeTimers();
    const operation = jest.fn().mockRejectedValue(new Error('boom'));
    const pending = retryRead(operation, 'getHealth');
    const assertion = expect(pending).rejects.toThrow('boom');
    await jest.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('resolves with the value when the operation eventually succeeds', async () => {
    jest.useFakeTimers();
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');
    const pending = retryRead(operation, 'getHealth');
    await jest.runAllTimersAsync();
    await expect(pending).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('resolveRpcUrl / useMockRpc', () => {
  it('returns the mock URL when USE_MOCK_RPC=1', () => {
    process.env.USE_MOCK_RPC = '1';
    delete process.env.RPC_MOCK;
    process.env.SOROBAN_RPC_URL = 'https://live.example/rpc';
    expect(useMockRpc()).toBe(true);
    expect(resolveRpcUrl()).toBe('http://localhost:8000/soroban/rpc');
  });

  it('returns the mock URL when RPC_MOCK=1', () => {
    delete process.env.USE_MOCK_RPC;
    process.env.RPC_MOCK = '1';
    expect(useMockRpc()).toBe(true);
    expect(resolveRpcUrl()).toBe('http://localhost:8000/soroban/rpc');
  });

  it('returns the configured SOROBAN_RPC_URL otherwise', () => {
    delete process.env.USE_MOCK_RPC;
    delete process.env.RPC_MOCK;
    process.env.SOROBAN_RPC_URL = 'https://live.example/rpc';
    expect(useMockRpc()).toBe(false);
    expect(resolveRpcUrl()).toBe('https://live.example/rpc');
  });
});
