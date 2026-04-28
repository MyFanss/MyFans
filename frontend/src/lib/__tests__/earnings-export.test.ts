import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transactionsToCSV, downloadCSV, reconciliationToCSV } from '../earnings-export';
import type { Transaction, ReconciliationRow } from '../earnings-api';

const TX: Transaction = {
  id: 'tx-1',
  date: '2024-03-15T10:30:00.000Z',
  type: 'subscription',
  description: 'Monthly plan',
  amount: '10.00',
  currency: 'USDC',
  status: 'completed',
  tx_hash: 'abc123',
};

describe('transactionsToCSV', () => {
  it('includes header row', () => {
    const csv = transactionsToCSV([TX], 'UTC');
    const [header] = csv.split('\n');
    expect(header).toBe('ID,Date (UTC),Date (Local),Type,Description,Amount,Currency,Status,TX Hash');
  });

  it('produces correct UTC timestamp', () => {
    const csv = transactionsToCSV([TX], 'UTC');
    expect(csv).toContain('2024-03-15T10:30:00.000Z');
  });

  it('includes timezone label in local timestamp', () => {
    const csv = transactionsToCSV([TX], 'America/New_York');
    expect(csv).toContain('America/New_York');
  });

  it('returns only header for empty array', () => {
    const csv = transactionsToCSV([], 'UTC');
    expect(csv.trim()).toBe('ID,Date (UTC),Date (Local),Type,Description,Amount,Currency,Status,TX Hash');
  });

  it('escapes commas in description', () => {
    const tx: Transaction = { ...TX, description: 'Plan, premium' };
    const csv = transactionsToCSV([tx], 'UTC');
    expect(csv).toContain('"Plan, premium"');
  });

  it('escapes double quotes in description', () => {
    const tx: Transaction = { ...TX, description: 'Say "hello"' };
    const csv = transactionsToCSV([tx], 'UTC');
    expect(csv).toContain('"Say ""hello"""');
  });

  it('handles missing tx_hash gracefully', () => {
    const tx: Transaction = { ...TX, tx_hash: undefined };
    const csv = transactionsToCSV([tx], 'UTC');
    const dataRow = csv.split('\n')[1];
    expect(dataRow.endsWith(',')).toBe(true); // last cell is empty
  });

  it('generates one data row per transaction', () => {
    const csv = transactionsToCSV([TX, TX], 'UTC');
    expect(csv.split('\n').length).toBe(3); // header + 2 rows
  });
});

describe('downloadCSV', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock');
    revokeObjectURL = vi.fn();
    clickSpy = vi.fn();

    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates a blob URL and triggers click', () => {
    downloadCSV('col1\nval1', 'test.csv');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('sets the correct filename', () => {
    let capturedLink: { download: string } | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        capturedLink = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
        return capturedLink as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    downloadCSV('data', 'earnings-2024-03-15.csv');
    expect(capturedLink?.download).toBe('earnings-2024-03-15.csv');
  });
});

const RECON_ROW: ReconciliationRow = {
  creator: 'GCREATORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  asset: 'USDC',
  totalGross: '100.0000000',
  totalFees: '5.0000000',
  totalNet: '95.0000000',
  paymentCount: 10,
};

describe('reconciliationToCSV', () => {
  it('includes correct header row', () => {
    const csv = reconciliationToCSV([RECON_ROW]);
    const [header] = csv.split('\n');
    expect(header).toBe('Creator,Asset,Gross,Protocol Fees,Net,Payments');
  });

  it('returns only header for empty array', () => {
    const csv = reconciliationToCSV([]);
    expect(csv.trim()).toBe('Creator,Asset,Gross,Protocol Fees,Net,Payments');
  });

  it('serialises all fields correctly', () => {
    const csv = reconciliationToCSV([RECON_ROW]);
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toBe(
      'GCREATORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,USDC,100.0000000,5.0000000,95.0000000,10',
    );
  });

  it('generates one data row per reconciliation row', () => {
    const csv = reconciliationToCSV([RECON_ROW, RECON_ROW]);
    expect(csv.split('\n').length).toBe(3); // header + 2 rows
  });

  it('escapes commas in creator address', () => {
    const row: ReconciliationRow = { ...RECON_ROW, creator: 'creator,with,commas' };
    const csv = reconciliationToCSV([row]);
    expect(csv).toContain('"creator,with,commas"');
  });
});
