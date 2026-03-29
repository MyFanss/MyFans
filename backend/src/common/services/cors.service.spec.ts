import { CorsService, CorsConfig } from './cors.service';

describe('CorsService', () => {
    let corsService: CorsService;

    beforeEach(() => {
        delete process.env.NODE_ENV;
        delete process.env.CORS_ALLOWED_ORIGINS;
        delete process.env.CORS_ALLOWED_HOSTS;
        corsService = new CorsService();
    });

    afterEach(() => {
        delete process.env.NODE_ENV;
        delete process.env.CORS_ALLOWED_ORIGINS;
        delete process.env.CORS_ALLOWED_HOSTS;
    });

    it('should be defined', () => {
        expect(corsService).toBeDefined();
    });

    describe('in development mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            corsService = new CorsService();
        });

        it('should allow localhost origins by default', () => {
            const config = corsService.getConfig();
            expect(config.allowedOrigins).toContain('http://localhost:3000');
            expect(config.allowedOrigins).toContain('http://localhost:5173');
            expect(config.allowedOrigins).toContain('http://127.0.0.1:3000');
        });

        it('should allow localhost hosts by default', () => {
            const config = corsService.getConfig();
            expect(config.allowedHosts).toContain('localhost');
            expect(config.allowedHosts).toContain('127.0.0.1');
        });

        it('should allow credentials', () => {
            const config = corsService.getConfig();
            expect(config.credentials).toBe(true);
        });

        it('should have correct max age', () => {
            const config = corsService.getConfig();
            expect(config.maxAge).toBe(86400);
        });

        it('should allow standard HTTP methods', () => {
            const config = corsService.getConfig();
            expect(config.allowedMethods).toContain('GET');
            expect(config.allowedMethods).toContain('POST');
            expect(config.allowedMethods).toContain('PUT');
            expect(config.allowedMethods).toContain('DELETE');
            expect(config.allowedMethods).toContain('OPTIONS');
        });

        it('should expose correlation ID headers', () => {
            const config = corsService.getConfig();
            expect(config.exposedHeaders).toContain('X-Correlation-ID');
            expect(config.exposedHeaders).toContain('X-Request-ID');
        });

        it('should allow custom origins from environment', () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://custom.dev:3000';
            corsService = new CorsService();
            const config = corsService.getConfig();
            expect(config.allowedOrigins).toContain('http://custom.dev:3000');
        });
    });

    describe('in production mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should not allow any origins by default (empty allowlist)', () => {
            corsService = new CorsService();
            const config = corsService.getConfig();
            expect(config.allowedOrigins).toEqual([]);
        });

        it('should only allow specified origins from environment', () => {
            process.env.CORS_ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
            corsService = new CorsService();
            const config = corsService.getConfig();
            expect(config.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
            expect(config.allowedOrigins).not.toContain('http://localhost:3000');
        });

        it('should only allow specified hosts from environment', () => {
            process.env.CORS_ALLOWED_HOSTS = 'example.com,app.example.com';
            corsService = new CorsService();
            const config = corsService.getConfig();
            expect(config.allowedHosts).toEqual(['example.com', 'app.example.com']);
            expect(config.allowedHosts).not.toContain('localhost');
        });

        it('should allow credentials in production', () => {
            corsService = new CorsService();
            const config = corsService.getConfig();
            expect(config.credentials).toBe(true);
        });
    });

    describe('getCorsOptions', () => {
        it('should return CORS options object with correct structure', () => {
            const options = corsService.getCorsOptions();
            expect(options).toHaveProperty('origin');
            expect(options).toHaveProperty('methods');
            expect(options).toHaveProperty('allowedHeaders');
            expect(options).toHaveProperty('exposedHeaders');
            expect(options).toHaveProperty('credentials');
            expect(options).toHaveProperty('maxAge');
        });

        it('should include required allowed headers', () => {
            const options = corsService.getCorsOptions();
            expect(options.allowedHeaders).toContain('Content-Type');
            expect(options.allowedHeaders).toContain('Authorization');
            expect(options.allowedHeaders).toContain('X-Correlation-ID');
            expect(options.allowedHeaders).toContain('X-Request-ID');
        });
    });

    describe('origin function', () => {
        it('should allow requests without origin', (done) => {
            const options = corsService.getCorsOptions();
            const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

            originFunction(undefined, (err, allow) => {
                expect(err).toBeNull();
                expect(allow).toBe(true);
                done();
            });
        });

        describe('in development', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'development';
                corsService = new CorsService();
            });

            it('should allow localhost origins', (done) => {
                const options = corsService.getCorsOptions();
                const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

                originFunction('http://localhost:3000', (err, allow) => {
                    expect(err).toBeNull();
                    expect(allow).toBe(true);
                    done();
                });
            });

            it('should allow 127.0.0.1 origins', (done) => {
                const options = corsService.getCorsOptions();
                const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

                originFunction('http://127.0.0.1:5173', (err, allow) => {
                    expect(err).toBeNull();
                    expect(allow).toBe(true);
                    done();
                });
            });
        });

        describe('in production', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
            });

            it('should block origins not in allowlist', (done) => {
                process.env.CORS_ALLOWED_ORIGINS = 'https://example.com';
                corsService = new CorsService();
                const options = corsService.getCorsOptions();
                const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

                originFunction('https://malicious.com', (err, allow) => {
                    expect(err).toBeNull();
                    expect(allow).toBe(false);
                    done();
                });
            });

            it('should allow origins in allowlist', (done) => {
                process.env.CORS_ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
                corsService = new CorsService();
                const options = corsService.getCorsOptions();
                const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

                originFunction('https://example.com', (err, allow) => {
                    expect(err).toBeNull();
                    expect(allow).toBe(true);
                    done();
                });
            });

            it('should block invalid URLs', (done) => {
                process.env.CORS_ALLOWED_ORIGINS = 'https://example.com';
                corsService = new CorsService();
                const options = corsService.getCorsOptions();
                const originFunction = options.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

                originFunction('not-a-valid-url', (err, allow) => {
                    expect(err).toBeNull();
                    expect(allow).toBe(false);
                    done();
                });
            });
        });
    });
});
