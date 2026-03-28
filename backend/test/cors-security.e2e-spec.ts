import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CORS and Security Headers (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Security Headers', () => {
        it('/ (GET) - should include security headers', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .expect(200);

            // Check security headers are present
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
            expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
            expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
            expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
            expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
            expect(response.headers['content-security-policy']).toBeDefined();
        });

        it('/ (GET) - should not expose X-Powered-By header', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .expect(200);

            expect(response.headers['x-powered-by']).toBeUndefined();
        });

        it('/ (GET) - should include correlation ID headers in response', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .set('X-Correlation-ID', 'test-correlation-id')
                .set('X-Request-ID', 'test-request-id')
                .expect(200);

            expect(response.headers['x-correlation-id']).toBe('test-correlation-id');
            expect(response.headers['x-request-id']).toBe('test-request-id');
        });
    });

    describe('CORS', () => {
        it('should handle CORS preflight requests', async () => {
            const response = await request(app.getHttpServer())
                .options('/')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'GET')
                .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
                .expect(200);

            // Check CORS headers
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
            expect(response.headers['access-control-allow-methods']).toContain('GET');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
            expect(response.headers['access-control-expose-headers']).toContain('X-Correlation-ID');
        });

        it('should include CORS headers on actual requests', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .set('Origin', 'http://localhost:3000')
                .expect(200);

            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });

        it('should handle requests without Origin header', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .expect(200);

            // Should still work without Origin header
            expect(response.status).toBe(200);
        });
    });

    describe('Production CORS behavior (simulated)', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://example.com';
        });

        afterAll(() => {
            delete process.env.NODE_ENV;
            delete process.env.CORS_ALLOWED_ORIGINS;
        });

        it('should block disallowed origins in production', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .set('Origin', 'https://malicious.com')
                .expect(200);

            // In production with strict CORS, this should not echo the malicious origin
            // Note: Actual blocking behavior depends on CORS configuration
            expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious.com');
        });
    });
});
