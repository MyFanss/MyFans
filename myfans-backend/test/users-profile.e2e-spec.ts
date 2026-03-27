import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';

describe('User profile (e2e)', () => {
  let app: INestApplication<App>;
  let userId: string;
  let authHeaders: () => Record<string, string>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    const email = `profile-${Date.now()}@e2e.test`;
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username: `u${Date.now()}` })
      .expect(201);
    userId = reg.body.id;

    authHeaders = () => ({
      Authorization: `Bearer ${userId}`,
      'X-User-Id': userId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/me returns profile', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .set(authHeaders())
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(userId);
        expect(res.body).toHaveProperty('email');
        expect(res.body).toHaveProperty('is_creator');
      });
  });

  it('PATCH /users/me updates display name and links', () => {
    return request(app.getHttpServer())
      .patch('/users/me')
      .set(authHeaders())
      .send({
        display_name: 'E2E User',
        website_url: 'https://example.com',
        x_handle: '@myhandle',
        instagram_handle: 'insta.user',
        other_url: 'https://linktr.ee/me',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.display_name).toBe('E2E User');
        expect(String(res.body.website_url)).toMatch(/^https:\/\/example\.com\/?$/);
        expect(res.body.x_handle).toBe('myhandle');
        expect(res.body.instagram_handle).toBe('insta.user');
      });
  });

  it('PATCH /users/me rejects invalid URL', () => {
    return request(app.getHttpServer())
      .patch('/users/me')
      .set(authHeaders())
      .send({ website_url: 'not-a-url' })
      .expect(400);
  });

  it('PATCH /creators/me returns 403 for fan user', () => {
    return request(app.getHttpServer())
      .patch('/creators/me')
      .set(authHeaders())
      .send({ bio: 'hello' })
      .expect(403);
  });
});
