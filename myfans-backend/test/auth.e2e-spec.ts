import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';

describe('AuthController (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        applyAppConfig(app);
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    const testUser = {
        email: 'test@example.com',
        username: 'testuser',
    };

    describe('/auth/register (POST)', () => {
        it('should register a new user', () => {
            return request(app.getHttpServer())
                .post('/auth/register')
                .send(testUser)
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('id');
                    expect(res.body.email).toBe(testUser.email);
                    expect(res.body.username).toBe(testUser.username);
                });
        });

        it('should return 409 when email already exists', () => {
            return request(app.getHttpServer())
                .post('/auth/register')
                .send(testUser)
                .expect(409);
        });
    });

    describe('/auth/login (POST)', () => {
        it('should login and return a token', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: testUser.email })
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('token');
                    expect(res.body).toHaveProperty('userId');
                });
        });

        it('should return 401 for non-existent user', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'nonexistent@example.com' })
                .expect(401);
        });
    });

    describe('Authorization Flow', () => {
        let token: string;
        let userId: string;

        beforeAll(async () => {
            const loginRes = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: testUser.email });
            token = loginRes.body.token;
            userId = loginRes.body.userId;
        });

        it('should return 401 for protected route without token', () => {
            return request(app.getHttpServer())
                .post(`/creators/${userId}/follow`) // Arbitrary protected route
                .expect(401);
        });

        it('should allow access to protected route with Bearer token', () => {
            return request(app.getHttpServer())
                .post(`/creators/${userId}/follow`)
                .set('Authorization', `Bearer ${token}`)
                // We expect a 404 perhaps if the creator ID (which is userId here) doesn't exist as a creator
                // but it shouldn't be 401 anymore
                .expect((res) => {
                    expect(res.status).not.toBe(401);
                    expect(res.status).not.toBe(403);
                });
        });

        it('should allow access to protected route with X-User-Id header', () => {
            return request(app.getHttpServer())
                .post(`/creators/${userId}/follow`)
                .set('x-user-id', userId)
                .expect((res) => {
                    expect(res.status).not.toBe(401);
                    expect(res.status).not.toBe(403);
                });
        });
    });
});
