/**
 * Unit tests for SorobanRpcService.getLatestLedgerSequence
 * and SorobanRpcService.getNetworkEvents
 */
import { SorobanRpcService } from './soroban-rpc.service';

function makeService(serverOverrides: Record<string, jest.Mock> = {}): SorobanRpcService {
  const svc = new SorobanRpcService();
  (svc as any).server = {
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy', ledger: 1000 }),
    getEvents: jest.fn().mockResolvedValue({ events: [], latestLedger: 1000 }),
    ...serverOverrides,
  };
  return svc;
}

describe('SorobanRpcService – getLatestLedgerSequence', () => {
  it('returns the ledger number from getHealth', async () => {
    const svc = makeService({ getHealth: jest.fn().mockResolvedValue({ status: 'healthy', ledger: 42 }) });
    await expect(svc.getLatestLedgerSequence()).resolves.toBe(42);
  });

  it('throws when server is null', async () => {
    const svc = makeService();
    (svc as any).server = null;
    await expect(svc.getLatestLedgerSequence()).rejects.toThrow('server not initialized');
  });

  it('throws when getHealth rejects', async () => {
    const svc = makeService({ getHealth: jest.fn().mockRejectedValue(new Error('network error')) });
    await expect(svc.getLatestLedgerSequence()).rejects.toThrow('network error');
  });

  it('throws when ledger field is missing or zero', async () => {
    const svc = makeService({ getHealth: jest.fn().mockResolvedValue({ status: 'healthy' }) });
    await expect(svc.getLatestLedgerSequence()).rejects.toThrow('invalid ledger sequence');
  });
});

describe('SorobanRpcService – getNetworkEvents', () => {
  it('returns events and latestLedger from getEvents', async () => {
    const fakeEvents = [{ id: '100:0', topic: [], value: {} }];
    const svc = makeService({
      getEvents: jest.fn().mockResolvedValue({ events: fakeEvents, latestLedger: 200 }),
    });
    const result = await svc.getNetworkEvents({ startLedger: 100 });
    expect(result.events).toEqual(fakeEvents);
    expect(result.latestLedger).toBe(200);
    expect(result.nextToken).toBeUndefined();
  });

  it('passes limit and cursor to getEvents', async () => {
    const getEvents = jest.fn().mockResolvedValue({ events: [], latestLedger: 300 });
    const svc = makeService({ getEvents });
    await svc.getNetworkEvents({ startLedger: 50, limit: 10, paginationToken: 'tok' });
    expect(getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 50, limit: 10, cursor: 'tok' }),
    );
  });

  it('returns empty events array when getEvents returns undefined events', async () => {
    const svc = makeService({ getEvents: jest.fn().mockResolvedValue({ latestLedger: 100 }) });
    const result = await svc.getNetworkEvents({ startLedger: 1 });
    expect(result.events).toEqual([]);
  });

  it('throws when server is null', async () => {
    const svc = makeService();
    (svc as any).server = null;
    await expect(svc.getNetworkEvents({ startLedger: 1 })).rejects.toThrow('server not initialized');
  });

  it('throws when getEvents rejects', async () => {
    const svc = makeService({ getEvents: jest.fn().mockRejectedValue(new Error('rpc down')) });
    await expect(svc.getNetworkEvents({ startLedger: 1 })).rejects.toThrow('rpc down');
  });
});
