import { ContractHealthService } from './contract-health.service';
import { loadContractIds } from './contract-ids.loader';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ContractHealthService', () => {
  let service: ContractHealthService;

  beforeEach(() => {
    service = new ContractHealthService();
    mockFetch.mockReset();
  });

  it('returns ok=false when contractId is empty', async () => {
    const result = await service.checkContract('myfans', '', 'is_subscriber');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('empty');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns ok=true on successful RPC response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: {} }),
    });
    const result = await service.checkContract('myfans', 'CABC123', 'is_subscriber');
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns ok=false on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const result = await service.checkContract('myfans', 'CABC123', 'is_subscriber');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('503');
  });

  it('returns ok=false on RPC error in response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: 'contract not found' } }),
    });
    const result = await service.checkContract('myfans', 'CABC123', 'is_subscriber');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('contract not found');
  });

  it('returns ok=false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await service.checkContract('myfans', 'CABC123', 'is_subscriber');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('runs multiple checks independently', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: {} }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    const [r1, r2] = await Promise.all([
      service.checkContract('myfans', 'CABC123', 'is_subscriber'),
      service.checkContract('myfans-token', 'CDEF456', 'version'),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
  });
});

describe('loadContractIds', () => {
  const tmpPath = resolve(__dirname, 'test-contract-ids.json');

  afterEach(() => {
    delete process.env.CONTRACT_ID_MYFANS;
    delete process.env.CONTRACT_ID_MYFANS_TOKEN;
    delete process.env.CONTRACT_IDS_PATH;
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  });

  it('loads from env vars when set', () => {
    process.env.CONTRACT_ID_MYFANS = 'CABC123';
    process.env.CONTRACT_ID_MYFANS_TOKEN = 'CDEF456';
    const ids = loadContractIds();
    expect(ids.myfans).toBe('CABC123');
    expect(ids.myfansToken).toBe('CDEF456');
  });

  it('loads from artifact file when env vars not set', () => {
    writeFileSync(tmpPath, JSON.stringify({ myfans: 'CFILE1', myfansToken: 'CFILE2' }));
    process.env.CONTRACT_IDS_PATH = tmpPath;
    const ids = loadContractIds();
    expect(ids.myfans).toBe('CFILE1');
    expect(ids.myfansToken).toBe('CFILE2');
  });

  it('throws when neither env vars nor file available', () => {
    process.env.CONTRACT_IDS_PATH = '/nonexistent/path.json';
    expect(() => loadContractIds()).toThrow('Cannot load contract IDs');
  });
});
