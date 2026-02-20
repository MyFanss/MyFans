import { DataSource } from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';
import { Post, PostType } from './post.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { User } from '../../users/entities/user.entity';

describe('Post Entity', () => {
  let dataSource: DataSource;
  let userRepo: ReturnType<DataSource['getRepository']>;
  let creatorRepo: ReturnType<DataSource['getRepository']>;
  let postRepo: ReturnType<DataSource['getRepository']>;
  let creator: Creator;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [User, Creator, Post, Subscription],
      synchronize: true,
    });
    await dataSource.initialize();

    userRepo = dataSource.getRepository(User);
    creatorRepo = dataSource.getRepository(Creator);
    postRepo = dataSource.getRepository(Post);

    const creatorUser = userRepo.create({
      email: 'creator@test.com',
      username: 'creator',
      is_creator: true,
    });
    await userRepo.save(creatorUser);

    creator = creatorRepo.create({
      user: creatorUser,
      bio: 'Bio',
      subscription_price: '9.99',
      currency: 'USDC',
    });
    await creatorRepo.save(creator);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await postRepo.clear();
  });

  it('can create post with creator_id, title, body, type, price, media_urls', async () => {
    const post = postRepo.create({
      creator,
      title: 'My First Post',
      body: 'Post body content',
      type: PostType.PAID,
      price: '4.99',
      media_urls: ['https://example.com/image1.jpg', 'https://example.com/video.mp4'],
      published_at: new Date(),
    });
    await postRepo.save(post);

    const loaded = await postRepo.findOne({
      where: { id: post.id },
      relations: ['creator'],
    });

    expect(loaded).toBeDefined();
    expect(loaded?.creator.id).toBe(creator.id);
    expect(loaded?.title).toBe('My First Post');
    expect(loaded?.body).toBe('Post body content');
    expect(loaded?.type).toBe(PostType.PAID);
    expect(String(loaded?.price)).toBe('4.99');
    expect(loaded?.media_urls).toEqual([
      'https://example.com/image1.jpg',
      'https://example.com/video.mp4',
    ]);
    expect(loaded?.published_at).toBeDefined();
  });

  it('supports draft (published_at null)', async () => {
    const post = postRepo.create({
      creator,
      title: 'Draft Post',
      body: 'Draft content',
      type: PostType.FREE,
      price: null,
      media_urls: [],
      published_at: null,
    });
    await postRepo.save(post);

    expect(post.published_at).toBeNull();
  });

  it('validates price is null when type is free', async () => {
    const post = postRepo.create({
      creator,
      title: 'Free Post',
      body: 'Content',
      type: PostType.FREE,
      price: '9.99',
      media_urls: [],
    });

    await expect(postRepo.save(post)).rejects.toThrow();
  });

  it('validates price >= 0 when type is paid', async () => {
    const post = postRepo.create({
      creator,
      title: 'Paid Post',
      body: 'Content',
      type: PostType.PAID,
      price: '-1',
      media_urls: [],
    });

    await expect(postRepo.save(post)).rejects.toThrow();
  });
});
