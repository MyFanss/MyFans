import { CircuitOpenError, resetCircuit, withRetry } from './rpc-retry';

const KEY = 'test-rpc';

beforeEach(() => resetCircuit(KEY));

describe('withRetry – transient errors', () => {
  it('succeeds after transient failures', async () => {
    let calls = 0;
    const result = await withRetry(KEY, async () => {
      if (++calls < 3) throw new Error('transient');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after exhausting maxAttempts', async () => {
    await expect(
      withRetry(KEY, async () => { throw new Error('always fails'); }, { maxAttempts: 3 }),
    ).rejects.toThrow('always fails');
  });
});

describe('withRetry – permanent errors', () => {
  it('does not retry permanent errors', async () => {
    let calls = 0;
    const permanent = new Error('invalid contract');
    await expect(
      withRetry(KEY, async () => { calls++; throw permanent; }, {
        isPermanentError: (e) => e instanceof Error && /invalid contract/.test(e.message),
      }),
    ).rejects.toThrow('invalid contract');
    expect(calls).toBe(1);
  });
});

describe('circuit breaker', () => {
  it('opens after threshold consecutive failures', async () => {
    const threshold = 3;
    // exhaust attempts without triggering circuit (maxAttempts < threshold)
    for (let i = 0; i < threshold - 1; i++) {
      await withRetry(KEY, async () => { throw new Error('fail'); }, {
        maxAttempts: 1,
        circuitBreakerThreshold: threshold,
      }).catch(() => {});
    }
    // one more failure should open the circuit
    await withRetry(KEY, async () => { throw new Error('fail'); }, {
      maxAttempts: 1,
      circuitBreakerThreshold: threshold,
    }).catch(() => {});

    await expect(
      withRetry(KEY, async () => 'should not run', { circuitBreakerThreshold: threshold }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('allows a probe after circuitResetMs', async () => {
    // Open the circuit with a 0ms reset window so it's immediately half-open
    await withRetry(KEY, async () => { throw new Error('fail'); }, {
      maxAttempts: 1,
      circuitBreakerThreshold: 1,
      circuitResetMs: 0,
    }).catch(() => {});

    // Next call: circuit reset window already elapsed → probe runs → succeeds
    const result = await withRetry(KEY, async () => 'recovered', {
      circuitBreakerThreshold: 1,
      circuitResetMs: 0,
    });
    expect(result).toBe('recovered');
  });
});
