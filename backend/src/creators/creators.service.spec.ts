import { CreatorsService } from './creators.service';

describe('CreatorsService.listCreators', () => {
  const buildService = (rows: any[]) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const repository: any = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    return { service: new CreatorsService(repository), qb };
  };

  it('returns an empty list when no creators match', async () => {
    const { service } = buildService([]);
    const result = await service.listCreators({ limit: 12, cursor: null, query: null });
    expect(result).toEqual([]);
  });

  it('maps a single stored row to the documented item shape', async () => {
    const { service } = buildService([
      {
        id: 'c1',
        handle: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        bio: 'hi',
        subscriberCount: 5,
        isVerified: true,
      },
    ]);
    const result = await service.listCreators({ limit: 12, cursor: null, query: null });
    expect(result).toEqual([
      {
        id: 'c1',
        handle: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        bio: 'hi',
        subscriberCount: 5,
        isVerified: true,
      },
    ]);
  });

  it('ignores a query shorter than two characters', async () => {
    const { service, qb } = buildService([]);
    await service.listCreators({ limit: 12, cursor: null, query: 'a' });
    const searchCalls = qb.andWhere.mock.calls.filter((call: any[]) =>
      String(call[0]).includes('ILIKE'),
    );
    expect(searchCalls).toHaveLength(0);
  });

  it('applies the trimmed query when it is long enough', async () => {
    const { service, qb } = buildService([]);
    await service.listCreators({ limit: 12, cursor: null, query: '  alice  ' });
    const searchCall = qb.andWhere.mock.calls.find((call: any[]) =>
      String(call[0]).includes('ILIKE'),
    );
    expect(searchCall?.[1]).toEqual({ term: '%alice%' });
  });

  it('uses the already-clamped limit as the page size', async () => {
    const { service, qb } = buildService([]);
    await service.listCreators({ limit: 50, cursor: null, query: null });
    expect(qb.take).toHaveBeenCalledWith(50);
  });
});
