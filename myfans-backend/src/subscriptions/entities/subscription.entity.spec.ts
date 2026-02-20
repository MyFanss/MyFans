import { DataSource } from 'typeorm';
import { Creator } from '../../creators/entities/creator.entity';
import { Post } from '../../posts/entities/post.entity';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { User } from '../../users/entities/user.entity';

describe('Subscription Entity', () => {
  let dataSource: DataSource;
  let userRepo: ReturnType<DataSource['getRepository']>;
  let creatorRepo: ReturnType<DataSource['getRepository']>;
  let subscriptionRepo: ReturnType<DataSource['getRepository']>;
  let fan: User;
  let creator: Creator;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [User, Creator, Subscription, Post],
      synchronize: true,
    });
    await dataSource.initialize();

    userRepo = dataSource.getRepository(User);
    creatorRepo = dataSource.getRepository(Creator);
    subscriptionRepo = dataSource.getRepository(Subscription);

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

    fan = userRepo.create({
      email: 'fan@test.com',
      username: 'fan',
      is_creator: false,
    });
    await userRepo.save(fan);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await subscriptionRepo.clear();
  });

  it('can create subscription with fan_id, creator_id, status, dates', async () => {
    const started = new Date();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const sub = subscriptionRepo.create({
      fan,
      creator,
      status: SubscriptionStatus.ACTIVE,
      started_at: started,
      expires_at: expires,
      plan_id: 'plan_123',
    });
    await subscriptionRepo.save(sub);

    const loaded = await subscriptionRepo.findOne({
      where: { id: sub.id },
      relations: ['fan', 'creator'],
    });

    expect(loaded).toBeDefined();
    expect(loaded?.fan.id).toBe(fan.id);
    expect(loaded?.creator.id).toBe(creator.id);
    expect(loaded?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(loaded?.plan_id).toBe('plan_123');
  });

  it('prevents duplicate active subscriptions for same fan-creator pair', async () => {
    const started = new Date();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const sub1 = subscriptionRepo.create({
      fan,
      creator,
      status: SubscriptionStatus.ACTIVE,
      started_at: started,
      expires_at: expires,
    });
    await subscriptionRepo.save(sub1);

    const sub2 = subscriptionRepo.create({
      fan,
      creator,
      status: SubscriptionStatus.ACTIVE,
      started_at: started,
      expires_at: expires,
    });

    await expect(subscriptionRepo.save(sub2)).rejects.toThrow();
  });
});
