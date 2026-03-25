/**
 * Social Links – integration / e2e test
 *
 * Demonstrates how to write a full integration test for the update-user
 * endpoint that includes social link validation.
 *
 * Replace UserModule, UserService, and UserController with your actual imports.
 * This file acts as the acceptance criteria verifier for the GitHub issue.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { SocialLinksModule } from '../social-links.module';

// ── Minimal stubs so the test module compiles without the full app ────────────

const MOCK_USER = {
  id: 'user-uuid',
  username: 'johndoe',
  displayName: 'John Doe',
  bio: 'Gamer',
  websiteUrl: null,
  twitterHandle: null,
  instagramHandle: null,
  otherLink: null,
};

class MockUserRepository {
  private store = { ...MOCK_USER };

  async findOne() {
    return { ...this.store };
  }

  async save(entity: any) {
    Object.assign(this.store, entity);
    return { ...this.store };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  The actual tests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOTE: These tests use a mock HTTP layer. If you have a real UserController
 * wired up, replace `MockUserController` below with your actual controller and
 * adjust the endpoint paths.
 */

import { Controller, Body, Param, Patch, Get } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SocialLinksDto } from '../dto/social-links.dto';
import { SocialLinksService } from '../social-links.service';

@Controller('users')
class MockUserController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Patch(':id/social-links')
  async updateSocialLinks(@Param('id') id: string, @Body() dto: SocialLinksDto) {
    const payload = this.socialLinksService.extractUpdatePayload(dto);
    return { ...MOCK_USER, ...payload };
  }

  @Get(':id/profile')
  async getProfile(@Param('id') id: string) {
    return {
      ...MOCK_USER,
      socialLinks: this.socialLinksService.toResponseDto(MOCK_USER),
    };
  }
}

describe('Social Links – Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SocialLinksModule],
      controllers: [MockUserController],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /users/:id/profile ─────────────────────────────────────────────────

  describe('GET /users/:id/profile', () => {
    it('returns socialLinks object in profile response', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/user-uuid/profile')
        .expect(200);

      expect(res.body).toHaveProperty('socialLinks');
      expect(res.body.socialLinks).toMatchObject({
        websiteUrl: null,
        twitterHandle: null,
        instagramHandle: null,
        otherLink: null,
      });
    });
  });

  // ── PATCH /users/:id/social-links ─────────────────────────────────────────

  describe('PATCH /users/:id/social-links', () => {
    it('AC: user can update social links with valid data', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({
          websiteUrl: 'https://johndoe.com',
          twitterHandle: '@johndoe',
          instagramHandle: 'johndoe',
          otherLink: 'https://linktr.ee/johndoe',
        })
        .expect(200);

      expect(res.body.websiteUrl).toBe('https://johndoe.com/');
      expect(res.body.twitterHandle).toBe('johndoe');
      expect(res.body.instagramHandle).toBe('johndoe');
      expect(res.body.otherLink).toBe('https://linktr.ee/johndoe/');
    });

    it('AC: invalid URL returns 400', async () => {
      await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({ websiteUrl: 'javascript:alert(1)' })
        .expect(400);
    });

    it('AC: invalid URL scheme (ftp) returns 400', async () => {
      await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({ otherLink: 'ftp://files.example.com' })
        .expect(400);
    });

    it('AC: invalid handle (contains space) returns 400', async () => {
      await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({ twitterHandle: 'john doe' })
        .expect(400);
    });

    it('allows empty/null social links', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({
          websiteUrl: null,
          twitterHandle: null,
        })
        .expect(200);

      expect(res.body.websiteUrl).toBeNull();
      expect(res.body.twitterHandle).toBeNull();
    });

    it('allows partial update (only one field)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({ websiteUrl: 'https://partial.com' })
        .expect(200);

      expect(res.body.websiteUrl).toBe('https://partial.com/');
    });

    it('strips @ from twitter handle', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/user-uuid/social-links')
        .send({ twitterHandle: '@CapitalUser' })
        .expect(200);

      expect(res.body.twitterHandle).toBe('capitaluser');
    });
  });
});
