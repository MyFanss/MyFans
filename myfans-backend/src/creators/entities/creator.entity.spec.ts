import { DataSource } from 'typeorm';
import { Creator } from './creator.entity';
import { Post } from '../../posts/entities/post.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { User } from '../../users/entities/user.entity';

describe('Creator Entity', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [User, Creator, Subscription, Post],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('can create and query Creator with User relation', async () => {
    const userRepo = dataSource.getRepository(User);
    const creatorRepo = dataSource.getRepository(Creator);

    const user = userRepo.create({
      email: 'creator@test.com',
      is_creator: true,
    });
    await userRepo.save(user);

    const creator = creatorRepo.create({
      user_id: user.id,
      bio: 'Test bio',
      subscription_price: '9.99',
      currency: 'USDC',
      is_verified: false,
    });
    await creatorRepo.save(creator);

    const loaded = await creatorRepo.findOne({
      where: { id: creator.id },
      relations: ['user'],
    });

    expect(loaded).toBeDefined();
    expect(loaded?.user).toBeDefined();
    expect(loaded?.user.id).toBe(user.id);
    expect(loaded?.user.email).toBe('creator@test.com');
    expect(loaded?.bio).toBe('Test bio');
    expect(Number(loaded?.subscription_price)).toBe(9.99);
    expect(loaded?.currency).toBe('USDC');
  });
});
