import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { Creator } from '../src/creators/entities/creator.entity';
import { User } from '../src/users/entities/user.entity';

describe('CreatorsController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let creatorRepo: Repository<Creator>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    creatorRepo = moduleFixture.get(getRepositoryToken(Creator));
  });

  afterEach(async () => {
    await creatorRepo.clear();
    await userRepo.clear();
    await app.close();
  });

  it('GET /creators returns paginated list without auth', () => {
    return request(app.getHttpServer())
      .get('/creators')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('limit');
        expect(res.body).toHaveProperty('total_pages');
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });

  it('GET /creators/:id returns 404 for non-existent creator', () => {
    return request(app.getHttpServer())
      .get('/creators/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /creators/by-username/:username returns 404 for non-existent username', () => {
    return request(app.getHttpServer())
      .get('/creators/by-username/nonexistent')
      .expect(404);
  });

  it('GET /creators/:id returns full public profile for existing creator', async () => {
    const user = userRepo.create({
      email: 'creator@test.com',
      username: 'testcreator',
      display_name: 'Test Creator',
      avatar_url: 'https://example.com/avatar.png',
      is_creator: true,
    });
    await userRepo.save(user);

    const creator = creatorRepo.create({
      user_id: user.id,
      bio: 'Full bio here',
      subscription_price: '9.99',
      currency: 'USDC',
      is_verified: true,
    });
    await creatorRepo.save(creator);

    return request(app.getHttpServer())
      .get(`/creators/${creator.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: creator.id,
          username: 'testcreator',
          display_name: 'Test Creator',
          avatar_url: 'https://example.com/avatar.png',
          bio: 'Full bio here',
          currency: 'USDC',
          is_verified: true,
          post_count: 0,
          subscriber_count: 0,
        });
      });
  });

  it('GET /creators/by-username/:username returns full profile', async () => {
    const user = userRepo.create({
      email: 'creator2@test.com',
      username: 'anothercreator',
      display_name: 'Another Creator',
      is_creator: true,
    });
    await userRepo.save(user);

    const creator = creatorRepo.create({
      user_id: user.id,
      bio: 'Bio',
      subscription_price: '0',
      currency: 'XLM',
      is_verified: false,
    });
    await creatorRepo.save(creator);

    return request(app.getHttpServer())
      .get('/creators/by-username/anothercreator')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          username: 'anothercreator',
          display_name: 'Another Creator',
          bio: 'Bio',
          currency: 'XLM',
          is_verified: false,
        });
      });
  });
});
