import { Test, TestingModule } from '@nestjs/testing';
import { StartupProbeService } from './startup-probe.service';

describe('StartupProbeService', () => {
  let service: StartupProbeService;
  const exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as never);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StartupProbeService],
    }).compile();

    service = module.get<StartupProbeService>(StartupProbeService);
    exitSpy.mockClear();
  });

  afterEach(() => {
    delete process.env.STARTUP_MODE;
    delete process.env.STARTUP_PROBE_DB;
    delete process.env.STARTUP_PROBE_RPC;
  });

  describe('probeDb', () => {
    it('returns ok when check passes', async () => {
      process.env.STARTUP_PROBE_DB = 'true';
      const result = await service.probeDb(async () => {});
      expect(result.ok).toBe(true);
    });

    it('returns ok when probe is disabled', async () => {
      process.env.STARTUP_PROBE_DB = 'false';
      const failFn = jest.fn().mockRejectedValue(new Error('should not call'));
      const result = await service.probeDb(failFn);
      expect(result.ok).toBe(true);
      expect(failFn).not.toHaveBeenCalled();
    });

    it('returns error after all retries fail', async () => {
      process.env.STARTUP_PROBE_DB = 'true';
      process.env.STARTUP_DB_RETRIES = '2';
      process.env.STARTUP_DB_RETRY_DELAY_MS = '0';
      const failFn = jest.fn().mockRejectedValue(new Error('connection refused'));
      const result = await service.probeDb(failFn);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('unreachable');
      expect(failFn).toHaveBeenCalledTimes(2);
    });

    it('succeeds on retry after initial failure', async () => {
      process.env.STARTUP_PROBE_DB = 'true';
      process.env.STARTUP_DB_RETRIES = '3';
      process.env.STARTUP_DB_RETRY_DELAY_MS = '0';
      const checkFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('not ready'))
        .mockResolvedValueOnce(undefined);
      const result = await service.probeDb(checkFn);
      expect(result.ok).toBe(true);
      expect(checkFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('probeRpc', () => {
    it('returns ok when probe is disabled', async () => {
      process.env.STARTUP_PROBE_RPC = 'false';
      const result = await service.probeRpc();
      expect(result.ok).toBe(true);
    });

    it('returns error after all retries fail', async () => {
      process.env.STARTUP_PROBE_RPC = 'true';
      process.env.STARTUP_RPC_RETRIES = '2';
      process.env.STARTUP_RPC_RETRY_DELAY_MS = '0';
      process.env.SOROBAN_RPC_URL = 'http://localhost:0';
      const result = await service.probeRpc();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('unreachable');
    });
  });

  describe('handleResult', () => {
    it('does nothing when result is ok', () => {
      service.handleResult('DB', { ok: true });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('calls process.exit(1) in fail-fast mode on failure', () => {
      process.env.STARTUP_MODE = 'fail-fast';
      service.handleResult('DB', { ok: false, error: 'DB unreachable' });
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('does not exit in degraded mode on failure', () => {
      process.env.STARTUP_MODE = 'degraded';
      service.handleResult('DB', { ok: false, error: 'DB unreachable' });
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
