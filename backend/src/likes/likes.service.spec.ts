import { Test, TestingModule } from '@nestjs/testing';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;

  const likes: Array<{ id: number; userId: number; postId: number }> = [];
  let nextId = 1;

  const repositoryMock = {
    findOne: jest.fn(async ({ where }: any) => {
      return (
        likes.find(
          (like) =>
            like.userId === where.userId && like.postId === where.postId,
        ) ?? null
      );
    }),
    create: jest.fn((data: any) => ({ id: nextId++, ...data })),
    save: jest.fn(async (entity: any) => {
      likes.push(entity);
      return entity;
    }),
    remove: jest.fn(async (entity: any) => {
      const index = likes.indexOf(entity);
      if (index >= 0) {
        likes.splice(index, 1);
      }
      return entity;
    }),
    count: jest.fn(async ({ where }: any) => {
      return likes.filter((like) => like.postId === where.postId).length;
    }),
  };

  beforeEach(async () => {
    likes.length = 0;
    nextId = 1;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: 'LikesRepository', useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not create a duplicate when the same user likes the same post twice', async () => {
    await service.like(1, 10);
    await service.like(1, 10);

    expect(repositoryMock.create).toHaveBeenCalledTimes(1);
    expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    expect(likes).toHaveLength(1);
  });

  it('is a no-op when unliking a post that was never liked', async () => {
    await expect(service.unlike(1, 10)).resolves.not.toThrow();

    expect(repositoryMock.remove).not.toHaveBeenCalled();
    expect(likes).toHaveLength(0);
  });

  it('returns the count that reflects the stored likes after like and unlike', async () => {
    const afterFirstLike = await service.like(1, 10);
    expect(afterFirstLike).toBe(1);

    const afterSecondLike = await service.like(1, 10);
    expect(afterSecondLike).toBe(1);

    const afterUnlike = await service.unlike(1, 10);
    expect(afterUnlike).toBe(0);

    const afterSecondUnlike = await service.unlike(1, 10);
    expect(afterSecondUnlike).toBe(0);
  });
});
