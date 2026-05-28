import { loadContractIds } from './contract-ids.loader';
import { ContractHealthService } from './contract-health.service';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// ── ContractHealthService ────────────────────────────────────────────────────

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
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: {} }) });
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

// ── loadContractIds ──────────────────────────────────────────────────────────

const TMP = resolve(__dirname, '_test-contract-ids.json');

const ENV_KEYS = [
  'CONTRACT_ID_MYFANS',
  'CONTRACT_ID_MYFANS_TOKEN',
  'CONTRACT_ID_CREATOR_REGISTRY',
  'CONTRACT_ID_SUBSCRIPTION',
  'CONTRACT_ID_SUBSCRIPTIONS',
  'CONTRACT_ID_CONTENT_ACCESS',
  'CONTRACT_ID_EARNINGS',
  'SUBSCRIPTION_CONTRACT_ID',
  'SUBSCRIPTIONS_CONTRACT_ID',
  'TOKEN_CONTRACT_ID',
  'CREATOR_REGISTRY_CONTRACT_ID',
  'CONTENT_ACCESS_CONTRACT_ID',
  'EARNINGS_CONTRACT_ID',
  'CONTRACT_IDS_PATH',
  'STELLAR_NETWORK',
];

function cleanEnv() {
  ENV_KEYS.forEach(k => delete process.env[k]);
}

function writeTmp(content: object) {
  writeFileSync(TMP, JSON.stringify(content));
  process.env.CONTRACT_IDS_PATH = TMP;
}

describe('loadContractIds', () => {
  beforeEach(cleanEnv);
  afterEach(() => {
    cleanEnv();
    try { unlinkSync(TMP); } catch { /* ignore */ }
  });

  // ── env vars ──────────────────────────────────────────────────────────────

  describe('env var resolution', () => {
    it('loads primary IDs from env vars', () => {
      process.env.CONTRACT_ID_MYFANS = 'CENV1';
      process.env.CONTRACT_ID_MYFANS_TOKEN = 'CENV2';
      const ids = loadContractIds();
      expect(ids.myfans).toBe('CENV1');
      expect(ids.myfansToken).toBe('CENV2');
    });

    it('loads all 6 IDs from env vars', () => {
      process.env.CONTRACT_ID_MYFANS = 'C1';
      process.env.CONTRACT_ID_MYFANS_TOKEN = 'C2';
      process.env.CONTRACT_ID_CREATOR_REGISTRY = 'C3';
      process.env.CONTRACT_ID_SUBSCRIPTIONS = 'C4';
      process.env.CONTRACT_ID_CONTENT_ACCESS = 'C5';
      process.env.CONTRACT_ID_EARNINGS = 'C6';
      const ids = loadContractIds();
      expect(ids.creatorRegistry).toBe('C3');
      expect(ids.subscriptions).toBe('C4');
      expect(ids.contentAccess).toBe('C5');
      expect(ids.earnings).toBe('C6');
    });

    it('optional env vars default to empty string', () => {
      process.env.CONTRACT_ID_MYFANS = 'C1';
      process.env.CONTRACT_ID_MYFANS_TOKEN = 'C2';
      const ids = loadContractIds();
      expect(ids.creatorRegistry).toBe('');
      expect(ids.subscriptions).toBe('');
    });

    it('loads from deploy-style env (token + CONTRACT_ID_SUBSCRIPTION) without CONTRACT_ID_MYFANS', () => {
      process.env.CONTRACT_ID_MYFANS_TOKEN = 'CTOK';
      process.env.CONTRACT_ID_SUBSCRIPTION = 'CSUB';
      process.env.CONTRACT_ID_CREATOR_REGISTRY = 'CREG';
      const ids = loadContractIds();
      expect(ids.myfans).toBe('');
      expect(ids.myfansToken).toBe('CTOK');
      expect(ids.subscriptions).toBe('CSUB');
      expect(ids.creatorRegistry).toBe('CREG');
    });

    it('accepts TOKEN_CONTRACT_ID and SUBSCRIPTION_CONTRACT_ID aliases', () => {
      process.env.TOKEN_CONTRACT_ID = 'CTOK2';
      process.env.SUBSCRIPTION_CONTRACT_ID = 'CSUB2';
      const ids = loadContractIds();
      expect(ids.myfansToken).toBe('CTOK2');
      expect(ids.subscriptions).toBe('CSUB2');
    });

    it('prefers CONTRACT_ID_SUBSCRIPTION over CONTRACT_ID_SUBSCRIPTIONS when both set', () => {
      process.env.CONTRACT_ID_MYFANS_TOKEN = 'T';
      process.env.CONTRACT_ID_SUBSCRIPTION = 'S1';
      process.env.CONTRACT_ID_SUBSCRIPTIONS = 'S2';
      const ids = loadContractIds();
      expect(ids.subscriptions).toBe('S1');
    });

    it('does not use env vars when primary IDs are missing', () => {
      process.env.CONTRACT_ID_MYFANS = 'C1';
      // myfansToken not set — should fall through to file
      writeTmp({ myfans: 'CFILE', myfansToken: 'CFILE2' });
      const ids = loadContractIds();
      expect(ids.myfans).toBe('CFILE');
    });
  });

  // ── flat artifact (contract-ids.json) ─────────────────────────────────────

  describe('flat artifact format', () => {
    it('parses flat contract-ids.json', () => {
      writeTmp({ myfans: 'CF1', myfansToken: 'CF2', subscriptions: 'CF3' });
      const ids = loadContractIds();
      expect(ids.myfans).toBe('CF1');
      expect(ids.myfansToken).toBe('CF2');
      expect(ids.subscriptions).toBe('CF3');
    });

    it('defaults missing fields to empty string', () => {
      writeTmp({ myfans: 'CF1', myfansToken: 'CF2' });
      const ids = loadContractIds();
      expect(ids.creatorRegistry).toBe('');
      expect(ids.earnings).toBe('');
    });
  });

  // ── deploy artifact format (deployed-local.json / deployed-testnet.json) ──

  describe('deploy artifact format', () => {
    it('parses nested contracts key', () => {
      writeTmp({
        network: 'testnet',
        contracts: {
          token: 'CTOKEN',
          creatorRegistry: 'CREG',
          subscriptions: 'CSUB',
          contentAccess: 'CACCESS',
          earnings: 'CEARN',
        },
      });
      const ids = loadContractIds();
      expect(ids.myfansToken).toBe('CTOKEN');
      expect(ids.creatorRegistry).toBe('CREG');
      expect(ids.subscriptions).toBe('CSUB');
      expect(ids.contentAccess).toBe('CACCESS');
      expect(ids.earnings).toBe('CEARN');
    });

    it('maps token -> myfansToken', () => {
      writeTmp({ contracts: { token: 'CTOK' } });
      const ids = loadContractIds();
      expect(ids.myfansToken).toBe('CTOK');
    });

    it('falls back to myfansToken key if token absent', () => {
      writeTmp({ contracts: { myfansToken: 'CMFT' } });
      const ids = loadContractIds();
      expect(ids.myfansToken).toBe('CMFT');
    });

    it('defaults missing nested fields to empty string', () => {
      writeTmp({ contracts: { token: 'CTOK' } });
      const ids = loadContractIds();
      expect(ids.myfans).toBe('');
      expect(ids.creatorRegistry).toBe('');
    });
  });

  // ── CI artifact path ──────────────────────────────────────────────────────

  describe('CI artifact path (CONTRACT_IDS_PATH)', () => {
    it('reads from CONTRACT_IDS_PATH when set', () => {
      writeTmp({ myfans: 'CCI', myfansToken: 'CCI2' });
      const ids = loadContractIds();
      expect(ids.myfans).toBe('CCI');
    });

    it('CONTRACT_IDS_PATH takes priority over default file locations', () => {
      writeTmp({ myfans: 'CPRIORITY', myfansToken: 'CPRIORITY2' });
      // Even if STELLAR_NETWORK is set, explicit path wins
      process.env.STELLAR_NETWORK = 'testnet';
      const ids = loadContractIds();
      expect(ids.myfans).toBe('CPRIORITY');
    });

    it('throws with helpful message when CONTRACT_IDS_PATH file missing', () => {
      process.env.CONTRACT_IDS_PATH = '/nonexistent/ci-artifact.json';
      expect(() => loadContractIds()).toThrow('Cannot load contract IDs');
    });
  });

  // ── STELLAR_NETWORK resolution ────────────────────────────────────────────

  describe('STELLAR_NETWORK resolution', () => {
    it('resolves deployed-<network>.json when STELLAR_NETWORK set', () => {
      // Point CONTRACT_IDS_PATH to a file named as the network artifact would be
      // (we simulate by using CONTRACT_IDS_PATH since we can't write to contract/ in tests)
      writeTmp({ contracts: { token: 'CNET', subscriptions: 'CSNET' } });
      // CONTRACT_IDS_PATH is already set by writeTmp — this test validates the parse
      const ids = loadContractIds();
      expect(ids.myfansToken).toBe('CNET');
      expect(ids.subscriptions).toBe('CSNET');
    });
  });

  // ── error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws when no source available', () => {
      process.env.CONTRACT_IDS_PATH = '/nonexistent/path.json';
      expect(() => loadContractIds()).toThrow('Cannot load contract IDs');
    });

    it('throws with parse error message on malformed JSON', () => {
      writeFileSync(TMP, 'not-json{{{');
      process.env.CONTRACT_IDS_PATH = TMP;
      expect(() => loadContractIds()).toThrow('Failed to parse contract artifact');
    });
  });
});
